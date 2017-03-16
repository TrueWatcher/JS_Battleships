"use strict";

/**
 * The top-level Controller.
 */
function TopManager() {
  
  var stageControllers = { 
    "local":{ "intro":Intro, "rules":RulesLocal, "ships":ShipsLocal, "fight":FightLocal, "finish":FinishLocal },
    "online":{"intro":Intro, "rules":RulesOnline, "ships":ShipsOnline, "fight":FightOnline, "finish":FinishOnline  } };
  
  /**
   * Picks the subcontroller.
   * @param string aOnline online or local
   * @param string aStage stage
   * @return function subcontroller constructor
   */
  function getStageController(aOnline,aStage) {
    if ( !aStage || aStage=="zero" ) aStage="intro";
    var sc = stageControllers [aOnline] [aStage];
    if (!sc) throw new Error ("Failed to find the stage controller for "+aOnline+" and "+aStage+"!");
    return sc;
  }
    
  /**
    * Main entry point to every controller affair.
    * Selects subcontroller and passes the command on to it.
    * When playing online, all subcontrollers send AJAX requests to server, so processaing is continued in this.pull.
    * @param string aStage stage related to the command, generally should be same as Global::_stage
    * @param string command
    * @param mixed data
    * @return mixed return value of subcontroller, currently void
    */
  this.go=function(aStage,command,data) {
    var stage=g.getStage();
    var state;
    if( stage=="zero" ) { 
      stage=g.setStage("intro");
      state=g.setState("intro");
    }
  
    // some commands are stage-ignorant, most are not
    if ( aStage!==stage && command!=="queryAll" /*&& command!=="queryPick"*/ && command!=="abort" ) { 
      alert("Command ("+command+") stage is "+aStage+", global is "+stage+"!");
      return false;
    }
    var Sc=getStageController(g.online,aStage);
    var sc=new Sc();
    //sc=new Intro();
    var r = sc.go(command,data);
  };
  
  /**
   * Processes the server response when playing online.
   * Designed to be as passive as possible, decisions were made in subcontrollers and on server. But still has to make some controller'd job. Uses custom events for that. 
   * @param string responseText response to AJAX HTTP request, normally JSON-encoded object
   * @return void
   */
  this.pull=function(responseText) {
    var responseObj={};    
    $("tech").innerHTML=" full response:<br />"+responseText;
    try { responseObj=JSON.parse(responseText); }
    catch (err) {
      alert ("Unparsable server response:"+responseText);
    }
    var stateChanged=adoptState(responseObj);
    if (stateChanged) onStateChange(responseObj,currentStage,stage,currentState,state);
    if ( responseObj["activeSide"] ) g.setActive(responseObj["activeSide"]);
    v1.consumeServerResponse(responseObj);
    if ( g.getStage()=="ships" || g.getStage()=="fight" || g.getStage()=="finish" ) {
      v.consumeServerResponse(responseObj,m);
    }
  };
    
  function adoptState(responseObj) {
    var stage,state,currentStage,currentState;
    stage=currentStage=g.getStage();
    state=currentState=g.getState();
    //alert("in Stage="+g.getStage());
    if ( responseObj["stage"] ) { 
      stage=responseObj["stage"];
    }
    if ( responseObj["state"] ) { 
      state=responseObj["state"];
    }
    if ( stage != currentStage || state != currentState ) {
      g.setStage(stage);
      g.setState(state);
      //alert("out stage="+g.getStage());
      return (true);
    }
    else return false;
  };
  
  // Handlers for custom events fired by TopManager::pull
  function onStateChange(responseObj,prevStage,stage,prevState,state) {
    if ( responseObj["players"] ) onRegistration();
    if ( responseObj["rulesSet"] ) g.importRules( responseObj["rulesSet"] );
    if ( (prevStage == "intro" || prevStage == "zero") && stage == "rules" ) { 
      v1.clearNote("intro");
      v1.initPicks();
      return;
    }
    if ( stage == "ships" && prevStage!=stage ) { 
      initPage2();
      return;
    }
    if ( stage == "fight" && prevStage == "intro" ) {
      initPage2();
      return;
    }
    if ( stage == "fight" && prevStage == "ships" ) {
      onInitFight();
      return;
    }
    if ( stage == "intro" && prevStage == "finish" ) {
      onReIntro();
      return;
    }  
    //if ( responseObj["moves"] ) onMovesReceived();
    //if ( responceObj["ships"] ) onShipsReceived();
    if ( stage == "finish" || state == "finish" ) {
      onFinish(responseObj);
      return;
    }
  }
  
  function onRegistration() {    
    g.pSide=readCookie("side");
    g.pName=readCookie("name");
    g.eSide=g.otherSide(g.pSide);
    //alert("cookies side="+g.pSide+", name="+ng.pName+".");
    if ( responseObj["players"] ) {
      var rp=responseObj["players"];
      if ( rp[g.pSide] != g.pName ) throw new Error("My name is "+g.pName+" in the cookie and "+rp[g.pSide]+" in the response!");
    }
    v1.ticks[g.pSide]="v";
    v1.ticks[g.eSide]="x";
    g._theme = v1.applyTheme();
    poller.start();
    //v1.initPicks();// makes problems
    v1.putNote("intro"," connected ");
  }
  
  function initPage2() {
    v1.putNote("rules","Loading page 2");
    //alert("Running page 2");
    
    if(typeof v !=="object") alert("onTransitToPage2: v is not the global object");
    if(typeof m !=="object") alert("onTransitToPage2: m is not the global object");
    v=new View(g);
    //alert ("theme:"+g._theme);
    m=new Model();      
    v.setBoards(g._theme);
    v.putNames();

    if (g.allowHideControls) { 
      hideElement("intro");
      hideElement("rules");
      hideElement("finish");
    }
    displayElement("main");
    v.dc.display();

    v.em.put(" ");
    if (g.getStage()=="ships") {
      g.setTotal(0);
      var mes="Draw your ships (";
      mes+=v.ps.showClearHistogram( g.getForces(),"return" );
      mes+="),<br />then press Done";
      v.pm.put(mes);
    }
    return;
  }
  
  function onInitFight() {
    if (g.allowHideControls) { 
      v.dc.hide();
    }    
  }

  function onFinish(r) {
    displayElement("finish");
    return;
//     if (!r["activeSide"]) alert ("No activeSide value in Finish stage");
//     if (r["activeSide"]==g.eSide) {
//       v.em.put('<span class="'+"lose"+'">ENEMY HAS WON !');
//     }
//     if (r["activeSide"]==g.pSide) {
//       v.pm.put('<span class="'+"win"+'">YOU HAVE WON !');
//     }
    //poller.stop();// there will be one last call
  }
  
  function onReIntro() {
    g = new Global();
    g.allowHideControls=true;
    if (g.allowHideControls) { 
      hideElement("main");
      hideElement("finish");
    }
    displayElement("intro");
    displayElement("rules");
  }
}// end TopManager

/**
 * Subcontroller for the Intro stage.
 * @constructor
 */
function Intro() {

  function deleteAllCookies() {
  // http://stackoverflow.com/questions/179355/clearing-all-cookies-with-javascript
    var cookies = document.cookie.split(";");

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];
      var eqPos = cookie.indexOf("=");
      var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }

  this.go = function(command,data) {
    var qs="";
    var names={};
    
    switch (command) {
      
    case "setTheme": 
      g._theme=v1.applyTheme();
      break;
      
    case "register":
      g.online="online";
      g._theme=v1.applyTheme();
      names=v1.getNames();
      g.setNames(names.p,names.e);
      qs="intro=register"+"&playerName="+names.p+"&enemyName="+names.e;
      sendRequest(qs);
      break;
      
    case "abort":
      v1.clearNames();
      g.clearNames();
      if (g.online=="online") {
        sendRequest("intro=abort");
        deleteAllCookies();
      }
      poller.stop();
      break;
      
    case "playLocally":
      if (poller) poller.stop();
      g.online="local";
      g._theme=v1.applyTheme();
      names=v1.getNames();
      g.setNames( names.p, "Local Script" );//local enemy is always Local Script
      g.pSide="A";
      g.eSide="B";
      v1.putNames( g.getName("A"), g.getName("B") );
      v1.applyTheme();
      v1.ticks={A:"v",B:"x"};
      g.setStage("rules");
      v1.initPicks();
      g.setState("converged");
      v1.putNote("intro","Playing locally");
      v1.putNote("rules","Playing locally");
      break;
      
    case "queryStage":
      qs="intro=queryStage";
      sendRequest(qs);
      break;
      
    case "queryAll":        
      sendRequest("intro=queryAll");
      break;
      
    default:
      throw new Error("Intro::go: unknown command:"+command+"!");
    }
  };
}// end Intro

/**
 * Subcontroller for the Rules stage.
 * @constructor
 */
function RulesOnline() {

  this.go = function(command,data) {
    var qs="",myPicks="";
    
    switch (command) {
      
    case "updPick":
      //alert("updPick "+data);
      var details={};
      var id=data;
      if (!id) break;
      details=v1.parsePickId(id);
      if ( details.side==g.pSide ) {
        v1.clearGroup(details.itemName, details.row, details.side);
        v1.tickHtml(id);
        myPicks=v1.readPicks(g.pSide);
        if ( !myPicks ) return false; 
        qs="rules=updPick&pick="+myPicks;
        sendRequest(qs);     
      }
      //alert("myPicks:"+myPicks);
      break;
      
    case "queryPick":
      sendRequest("rules=queryPick");
      break;
      
    case "confirm":
      myPicks=v1.readPicks(g.pSide);
      if ( !myPicks ) break;
      var otherPicks=v1.readPicks(g.eSide);
      if ( myPicks!==otherPicks ) {
        alert ("You answers are different from your opponent's, go on bargaining");
        break;
      }
      v1.putNote("rules","Almost done...");
      g.setRules(myPicks);
      qs="rules=confirm&pick="+myPicks+"&rulesSet="+g.exportRules();
      sendRequest(qs);
      break;
      
    default:
      throw new Error("RulesOnline::go: unknown command:"+command+"!");
    }      
  }; 
}

/**
 * Subcontroller for the Ships stage.
 * @constructor
 */
function ShipsOnline() {
  
  this.go=function(command,data) {
    var parsed=[],qs="",c="",sy,ps,h,hs,cm;
    
    v.pm.put("");
    
    switch(command) {
      
    case "cell":
      // processed locally
      parsed = v.parseGridId(data);
      //alert ( "cell :"+parsed.row+"_"+parsed.col );
      if (parsed.prefix=="p") {
        if ( m.playerBasin.get(parsed.row,parsed.col) != "s" ) c="s";
        else c="e";
        m.playerBasin.put(c,parsed.row,parsed.col);
        v.pb.put(c,parsed.row,parsed.col);
      }
      break;
      
    case "rs": // remove all ships
      m.playerBasin.clear();
      v.pb.fromBasin(m.playerBasin);
      break;

    case "as": // automatically draw ships
      sy=new ShipYard(g.getForces());
      ps=sy.buildAll();
      m.playerBasin.clear();
      m.playerBasin.takeShips(ps);
      v.pb.fromBasin(m.playerBasin);
      break;
      
    case "cs": // check up and go playing
      h=new Harvester(m.playerBasin);
      h.search();
      m.playerBasin.cleanUp();
      v.pb.fromBasin(m.playerBasin);
      hs=h.yield();
      m.playerShips = new Fleet();
      m.playerShips.take(hs);
      if ( ! m.playerShips.checkMargins() ) {
        v.pm.put("Ships must be straight<br /> and not to touch each other. <br />Try new ones");
        m.playerShips.clear();
        return;
      }
      hs=JSON.stringify(hs);
      qs="ships=confirmShips&fleet="+hs;
      sendRequest(qs);
      break;
      
    case "queryStage": // check opponent's status with server
      qs="ships=queryStage";
      sendRequest(qs);
      break;
      
    default:
      throw new Error("ShipsOnline::go: unknown command:"+command+"!");
    } 
  };
}

/**
 * Subcontroller for the Fight stage.
 * @constructor
 */
function FightOnline() {
  
  this.go=function(command,data) {
    var parsed={},qs="",c="",sy,ps,h,hs,cm;
    
    switch(command) {
      
    case "cell":
      if (g.getActive()!==g.pSide) break;
      parsed = v.parseGridId(data);
      //alert ( "cell : "+parsed.prefix+"_"+parsed.row+"_"+parsed.col );
      if ( parsed.prefix == "e" ) {
        c="f";
        v.tb.put(c,parsed.row,parsed.col);
        //g.incTotal(); // moves are counted in View::putMove
        qs="fight=strike&rc=["+parsed.row+","+parsed.col+"]&thisMove="+(g.getTotal()+1);
        //alert("qs="+qs);
        sendRequest(qs);
        break;
      }
      break;
    
    case "queryMoves":
       qs="fight=queryMoves&latest="+g.getTotal();
       sendRequest(qs);
       break;
       
    default:
      throw new Error("ShipsOnline::go: unknown command:"+command+"!");
    }
  };
}

/**
 * Subcontroller for the Finish stage.
 * @constructor
 */
function FinishOnline() {
  
  this.go=function(command,data) {
    var qs="";
    switch (command) {
      
    case "quit":
      window.close();
      alert("You may close the browser window at any time");
      break;
      
    case "more":      
      qs="finish=more";
      sendRequest(qs);
      break;
      
    case "new":      
      qs="finish=new";
      sendRequest(qs);
      break;
      
    case "queryStage":
      qs="finish=queryStage";
      sendRequest(qs);
      break;    
      
    default:
      throw new Error("ShipsOnline::go: unknown command:"+command+"!");      
    }
  };  
}

// Offline subcontrollers are in separate file

// timer "event"
function onPoll() { 
  //alert ("poll, stage="+g.getStage());
  var divisors={intro:3,rules:0,ships:1,fight:0,finish:3};
  if ( typeof this._i == undefined ) this._i=0;
  var stage=g.getStage();
  var state=g.getState();
  
  if ( divisors[stage]<0 ) return;
  if ( this._i < divisors[stage] ) {
    this._i +=1;
    return;
  }
  this._i = 0;
  
  if ( stage=="intro" && state=="connecting" ) {
    tm.go("intro","queryStage");
    return;
  }
  if ( stage=="rules" ) { 
    tm.go("rules","queryPick");
    return;
  }
  if ( stage=="ships" && state=="confirmingShips" ) {
    tm.go("ships","queryStage");
    return;
  }
  if ( stage=="fight" && ( g.getActive() != g.pSide ) ) {
    tm.go("fight","queryMoves");
    return;
  }
  if ( stage=="finish" && ( state=="cycling" || state=="cyclingReq" || state=="cyclingOk" ) ) {
    tm.go("finish","queryStage");
    return;
  }
}

// AJAX response ready "event"
function onAjaxReceived(responseText) { tm.pull(responseText); }

