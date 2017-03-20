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
    var stage=global.getStage();
    var state;
    if( stage=="zero" ) { 
      stage=global.setStage("intro");
      state=global.setState("intro");
    }
  
    // some commands are stage-ignorant, most are not
    if ( aStage!==stage && command!=="queryAll" /*&& command!=="queryPick"*/ && command!=="abort" ) { 
      alert("Command ("+command+") stage is "+aStage+", global is "+stage+"!");
      return false;
    }
    var Sc=getStageController(global.online,aStage);
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
    stage=global.getStage();
    $("tech").innerHTML=" full response:<br />"+responseText;
    try { 
      responseObj=JSON.parse(responseText); 
    }
    catch (err) {
      alert ("Unparsable server response:"+responseText);
    }
    var stateChanged=adoptState(responseObj);
    if (stateChanged) onStateChange(responseObj,currentStage,stage,currentState,state);
    if ( responseObj["activeSide"] ) global.setActive(responseObj["activeSide"]);
    view1.consumeServerResponse(responseObj);
    if ( stage=="ships" || stage=="fight" || stage=="finish" ) {
      view2.consumeServerResponse(responseObj,model);
    }
  };
  
  var stage,state,currentStage,currentState;// output vars of adoptState()
  
  function adoptState(responseObj) {
    stage=currentStage=global.getStage();
    state=currentState=global.getState();
    //alert("in Stage="+global.getStage());
    if ( responseObj["stage"] ) { 
      stage=responseObj["stage"];
    }
    if ( responseObj["state"] ) { 
      state=responseObj["state"];
    }
    if ( stage != currentStage || state != currentState ) {
      global.setStage(stage);
      global.setState(state);
      //alert("out stage="+global.getStage());
      return (true);
    }
    else return false;
  };
  
  // Handlers for custom events fired by TopManager::pull
  function onStateChange(responseObj,prevStage,stage,prevState,state) {
    if ( responseObj["players"] ) onRegistration(responseObj);
    if ( responseObj["rulesSet"] ) global.importRules( responseObj["rulesSet"] );
    if ( (prevStage == "intro" || prevStage == "zero") && stage == "rules" ) { 
      view1.clearNote("intro");
      view1.initPicks();
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
  
  function onRegistration(responseObj) {    
    global.pSide=readCookie("side");
    global.pName=readCookie("name");
    global.eSide=global.otherSide(global.pSide);
    //alert("cookies side="+global.pSide+", name="+nglobal.pName+".");
    if ( responseObj["players"] ) {
      var rp=responseObj["players"];
      if ( rp[global.pSide] != global.pName ) throw new Error("My name is "+global.pName+" in the cookie and "+rp[global.pSide]+" in the response!");
    }
    view1.ticks[global.pSide]="v";
    view1.ticks[global.eSide]="x";
    global._theme = view1.applyTheme();
    poller.start();
    //view1.initPicks();// makes problems
    view1.putNote("intro"," connected ");
  }
  
  function initPage2() {
    view1.putNote("rules","Loading page 2");
    //alert("Running page 2");
    
    if(typeof view2 !=="object") throw new Error("view2 is not the global object");
    if(typeof model !=="object") throw new Error("model is not the global object");
    view2=new View(global);
    //alert ("theme:"+global._theme);
    model=new Model();      
    view2.setBoards(global._theme);
    view2.putNames();

    if (global.allowHideControls) { 
      hideElement("intro");
      hideElement("rules");
      hideElement("finish");
    }
    displayElement("main");
    view2.dc.display();

    view2.em.put(" ");
    if (global.getStage()=="ships") {
      global.setTotal(0);
      var mes="Draw your ships (";
      mes+=view2.ps.showClearHistogram( global.getForces(),"return" );
      mes+="),<br />then press Done";
      view2.pm.put(mes);
    }
    return;
  }
  
  function onInitFight() {
    if (global.allowHideControls) { 
      view2.dc.hide();
    }    
  }

  function onFinish(r) {
    displayElement("finish");
    return;
//     if (!r["activeSide"]) alert ("No activeSide value in Finish stage");
//     if (r["activeSide"]==global.eSide) {
//       view2.em.put('<span class="'+"lose"+'">ENEMY HAS WON !');
//     }
//     if (r["activeSide"]==global.pSide) {
//       view2.pm.put('<span class="'+"win"+'">YOU HAVE WON !');
//     }
    //poller.stop();// there will be one last call
  }
  
  function onReIntro() {
    global = new Global();
    global.allowHideControls=true;
    if (global.allowHideControls) { 
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
      global._theme=view1.applyTheme();
      break;
      
    case "register":
      global.online="online";
      global._theme=view1.applyTheme();
      names=view1.getNames();
      global.setNames(names.p,names.e);
      qs="intro=register"+"&playerName="+names.p+"&enemyName="+names.e;
      sendRequest(qs);
      break;
      
    case "abort":
      view1.clearNames();
      global.clearNames();
      if (global.online=="online") {
        sendRequest("intro=abort");
        deleteAllCookies();
      }
      poller.stop();
      break;
      
    case "playLocally":
      if (poller) poller.stop();
      global.online="local";
      global._theme=view1.applyTheme();
      names=view1.getNames();
      global.setNames( names.p, "Local Script" );//local enemy is always Local Script
      global.pSide="A";
      global.eSide="B";
      view1.putNames( global.getName("A"), global.getName("B") );
      view1.applyTheme();
      view1.ticks={A:"v",B:"x"};
      global.setStage("rules");
      view1.initPicks();
      global.setState("converged");
      view1.putNote("intro","Playing locally");
      view1.putNote("rules","Playing locally");
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
      details=view1.parsePickId(id);
      if ( details.side==global.pSide ) {
        view1.clearGroup(details.itemName, details.row, details.side);
        view1.tickHtml(id);
        myPicks=view1.readPicks(global.pSide);
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
      myPicks=view1.readPicks(global.pSide);
      if ( !myPicks ) break;
      var otherPicks=view1.readPicks(global.eSide);
      if ( myPicks!==otherPicks ) {
        alert ("You answers are different from your opponent's, go on bargaining");
        break;
      }
      view1.putNote("rules","Almost done...");
      global.setRules(myPicks);
      qs="rules=confirm&pick="+myPicks+"&rulesSet="+global.exportRules();
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
    
    view2.pm.put("");
    
    switch(command) {
      
    case "cell":
      // processed locally
      parsed = view2.parseGridId(data);
      //alert ( "cell :"+parsed.row+"_"+parsed.col );
      if (parsed.prefix=="p") {
        if ( model.playerBasin.get(parsed.row,parsed.col) != "s" ) c="s";
        else c="e";
        model.playerBasin.put(c,parsed.row,parsed.col);
        view2.pb.put(c,parsed.row,parsed.col);
      }
      break;
      
    case "rs": // remove all ships
      model.playerBasin.clear();
      view2.pb.fromBasin(model.playerBasin);
      break;

    case "as": // automatically draw ships
      sy=new ShipYard(global.getForces());
      ps=sy.buildAll();
      model.playerBasin.clear();
      model.playerBasin.takeShips(ps);
      view2.pb.fromBasin(model.playerBasin);
      break;
      
    case "cs": // check up and go playing
      h=new Harvester(model.playerBasin);
      h.search();
      model.playerBasin.cleanUp();
      view2.pb.fromBasin(model.playerBasin);
      hs=h.yield();
      model.playerShips = new Fleet();
      model.playerShips.take(hs);
      if ( ! model.playerShips.checkMargins() ) {
        view2.pm.put("Ships must be straight<br /> and not to touch each other. <br />Try new ones");
        model.playerShips.clear();
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
      if (global.getActive()!==global.pSide) break;
      parsed = view2.parseGridId(data);
      //alert ( "cell : "+parsed.prefix+"_"+parsed.row+"_"+parsed.col );
      if ( parsed.prefix == "e" ) {
        c="f";
        view2.tb.put(c,parsed.row,parsed.col);
        //global.incTotal(); // moves are counted in View::putMove
        qs="fight=strike&rc=["+parsed.row+","+parsed.col+"]&thisMove="+(global.getTotal()+1);
        //alert("qs="+qs);
        sendRequest(qs);
        break;
      }
      break;
    
    case "queryMoves":
       qs="fight=queryMoves&latest="+global.getTotal();
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
  //alert ("poll, stage="+global.getStage());
  var divisors={intro:3,rules:0,ships:1,fight:0,finish:3};
  if ( typeof this._i == undefined ) this._i=0;
  var stage=global.getStage();
  var state=global.getState();
  
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
  if ( stage=="fight" && ( global.getActive() != global.pSide ) ) {
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
