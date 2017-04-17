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
    if ( aStage!==stage && command!=="queryAll" && command!=="abort" ) { 
      //alert("Command ("+command+") stage is "+aStage+", global is "+stage+"!");
      console.log("Command ("+command+") stage is "+aStage+", global is "+stage+"!");
      return false;
    }
    var Sc=getStageController(global.online,aStage);
    var sc=new Sc();
    var r = sc.go(command,data);
  };
  
  /**
   * Processes the server response when playing online.
   * Designed to be as passive as possible, decisions were made in subcontrollers and on server. But still has to make some controller's job. Uses custom events pattern for that. Very sensitive to the order of calling lower-level routines.
   * @param string responseText response to AJAX HTTP request, normally JSON-encoded object
   * @return void
   */
  this.pull=function(responseText) {
    var responseObj={};
    var changed;
    var stage=global.getStage();
    
    responseObj=tryJsonParse(responseText);
    changed=adoptState(responseObj);// sets global stage, state and active
    if (changed) { 
      stage=changed.toStage;
      this.stateOperator.go(responseObj,changed);
    }
    if ( changed.stageChanged ) this.arrangePanels (changed,global.online);
    if ( isPage1(stage) ) {
      view1.consumeServerResponse(responseObj);
    }
    else if ( isPage2(stage) ) {
      view2.consumeServerResponse(responseObj,model,global.pSide);
    } else {}
  };
  
  function tryJsonParse(responseText) {
    var responseObj={};
    try { 
      responseObj=JSON.parse(responseText); 
    }
    catch (err) {
      alert ("Unparsable server response:"+responseText);
    }
    return responseObj;
  }
  
  function isPage1(stage) {
    var r=(stage=="zero" || stage=="intro" || stage=="rules");
    return (r);
  }
  
  function isPage2(stage) {
    var r=(stage=="ships" || stage=="fight" || stage=="finish");
    return (r);
  }

  function adoptState(responseObj) {
    var changesMap={};
    var stateChanged,stageChanged;
    var toStage,fromStage,toState,fromState;
    toStage=fromStage=global.getStage();
    toState=fromState=global.getState();
    //alert("in Stage="+global.getStage());
    if ( responseObj.hasOwnProperty("activeSide")  && String(responseObj["activeSide"]).length==1 ) { 
      global.setActive(responseObj["activeSide"]);
    }
    if ( responseObj.hasOwnProperty("stage") ) { 
      toStage=responseObj["stage"];
    }
    if ( responseObj.hasOwnProperty("state") ) { 
      toState=responseObj["state"];
    }
    stageChanged = (toStage != fromStage);
    stateChanged = (toState != fromState);
    if ( stageChanged || stateChanged ) {
      global.setStage(toStage);
      global.setState(toState);
      //alert("out stage="+global.getStage());
      changesMap={
        toStage:toStage, toState:toState, fromStage:fromStage, fromState:fromState,
        stageChanged:stageChanged, stateChanged:stateChanged
      };
      return (changesMap);
    }
    else { return false; }
  };
  
  this.stateOperator=new StateOperator();
  
  this.arrangePanels = function (changesMap,online) {
    var toStage=changesMap.toStage;
    var fromStage=changesMap.fromStage;
    
    if (!global.hideInactivePanels) return;
    if (typeof view1.ap == "object" ) {
      if (online=="online") { view1.ap.display(); }
      else { view1.ap.hide(); }
    }
    if ( toStage=="intro" || toStage=="rules" ) {
      if ( fromStage=="finish" && toStage=="intro" ) {
        view2.panels.page2.hide();
        view2.panels.finish.hide();
        view1.panels[toStage].display();
        view1.panels.rules.hide();
      }
      else if ( ( fromStage=="intro" && toStage=="rules" ) ) {
        view1.panels[toStage].display();
        view1.panels[fromStage].hide();
      }
      else if ( toStage=="intro" ) {
        view1.panels[toStage].display();
        view1.panels.rules.hide();
      }
      else throw new Error("Unknown toStage/fromStage "+toStage+"/"+fromStage);
    } 
    else if ( toStage=="ships" || toStage=="fight" || toStage=="finish" ) {
      if ( fromStage=="rules" && toStage=="ships" ) {
        view1.panels[fromStage].hide();
        view2.panels.page2.display();
        view2.panels[toStage].display();
      }
      else if ( ( fromStage=="ships" && toStage=="fight" ) || ( fromStage=="fight" && toStage=="finish" ) || ( fromStage=="finish" && toStage=="ships" ) ) {
        view2.panels[toStage].display();
        view2.panels[fromStage].hide();
      }
      else if ( fromStage=="intro" ) { // page reload
        view1.panels.page1.hide();
        view2.panels.page2.display();
        if (toStage !="ships") view2.panels.ships.hide();
        if (toStage !="finish") view2.panels.finish.hide();
        view2.panels[toStage].display();
      }
      else throw new Error("Unknown toStage/fromStage "+toStage+"/"+fromStage);      
    }
    else if (toStage=="aborted") {}
    else throw new Error ("Wrong toStage:"+toStage);
  };
}// end TopManager

/**
 * Performs initializations of View and Model units when stage/state changes.
 * Global stage, state and active have been already set in topManager::adoptState
 * @constructor
 */ 
function StateOperator() {
  
  /**
   * Dispatches particular "events", triggered by stage/state change.
   * Must call them in the logical order of initialization, so is very sensitive.
   * @return void
   */  
  this.go=function(responseObj,changesMap) {
    var fromStage=changesMap.fromStage;
    var toStage=changesMap.toStage;
    var fromState=changesMap.fromState;
    var toState=changesMap.toState;

    if ( responseObj["players"] && responseObj["players"]["A"] ) {
      onRegistration(responseObj);
    }
    if ( responseObj["rulesSet"] && responseObj["rulesSet"]["firstActiveAB"] ) {
      global.importRules( responseObj["rulesSet"] );
    }
    if ( responseObj["activeSide"] && String(responseObj["activeSide"]).length==1 )  {
      global.setActive(responseObj["activeSide"]); 
      // duplicated from adoptState() because importRules sets active to firstActive
    }
    
    if (toStage=="ships" || toStage=="fight") {
      model.consumeFleet(responseObj,global.pSide);// requires pSide < onRegistration
    }
    if ( (fromStage == "intro" || fromStage == "zero") && toStage == "rules" ) {
      onIntro2Rules();
      return;
    }
    
    if ( toStage == "ships" && fromStage == "finish" ) { 
      model=new Model();
      initPage2();
      return;
    }
    if ( toStage == "ships" && fromStage!=toStage ) { 
      initPage2();
      return;
    }
    if ( toStage == "fight" && fromStage == "intro" ) {
      initPage2();
      onInitFight();
      return;
    }
    if ( toStage == "fight" && fromStage == "ships" ) {
      onInitFight();
      return;
    }
    if ( toStage == "intro" && fromStage == "finish" ) {
      onReIntro();
      return;
    }  
    //if ( responseObj["moves"] ) onMovesReceived();
    //if ( responceObj["ships"] ) onShipsReceived();
    if ( toStage == "finish" || toState == "finish" ) {
      onFinish(responseObj);
      return;
    }
    if ( toStage == "aborted" || toState == "aborted" ) {
      onAbort(responseObj);
      return;
    }    
  };
  
  // Handlers for custom events fired by TopManager::pull
  
  function onRegistration(responseObj) {    
    global.pSide=readCookie("side");
    global.pName=readCookie("name");
    global.dealId=readCookie("dealId");
    global.eSide=global.otherSide(global.pSide);
    //alert("cookies side="+global.pSide+", name="+nglobal.pName+".");
    //if ( responseObj.hasOwnProperty("players") ) {
      var rp=responseObj["players"];
      if ( rp[global.pSide] != global.pName ) throw new Error("My name is "+global.pName+" in the cookie and "+rp[global.pSide]+" in the response!");
    //}
    view1.ticks[global.pSide]="v";
    view1.ticks[global.eSide]="x";
    global._theme = view1.applyTheme();
    poller.start();
    //if (global.hideInactivePanels) { displayElement("ajaxPanel"); } 
    //view1.initPicks();// makes problems
    view1.putNote("intro"," connected ");
  }
  
  function onIntro2Rules() {
    //alert("onIntro2Rules");
    view1.clearNote("intro");
    view1.initPicks();
  }
  
  function initPage2() {
    view1.putNote("rules","Loading page 2");
    //alert("Running page 2");
    
    if(typeof view2 !=="object") throw new Error("view2 is not the global object");
    if(typeof model !=="object") throw new Error("model is not the global object");
    //model=new Model();// erases fleet read in onStateChange - conflicts with makeHistogram
    view2=new View2(global);
    //alert ("theme:"+global._theme);
    view2.setBoards(global._theme);
    view2.putNames();

    view2.eMessage.put(" ");
    if (global.getStage()=="ships") { // as it may be called also to init "fight"
      global.setTotal(0);
      var mes="Draw your ships (";
      mes+=view2.pStat.showClearHistogram( global.getForces(),"return" );
      mes+="),<br />then press Done";
      view2.pMessage.put(mes);
    }
    return;
  }
  
  function onInitFight() {
    var myHist=model.playerShips.makeHistogram();
    view2.pStat.showClearHistogram(myHist);
    if (global._demandEqualForces) { view2.eStat.showClearHistogram(myHist); }  
  }

  function onFinish(r) {
    if ( r.hasOwnProperty("winner") ) { global._winner=r["winner"]; }
    return;
  }
  
  function onReIntro() {
    global=new Global();
    model=new Model();
    global.hideInactivePanels=true;
  }
  
  function onAbort() {
    deleteAllCookies();
    var nfl=new FinishLocal();
    nfl.go("new");
    view1.putNote("intro","Game is aborted, you may register again");
  }
  
}// end StateOperator


/**
 * Subcontroller for the Intro stage.
 * @constructor
 */
function Intro() {

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
      if (global.hideInactivePanels) {
        displayElement("rules");
        hideElement("intro");
        hideElement("ajaxPanel");
      }
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
    
    view2.pMessage.put("");
    
    switch(command) {
      
    case "cell":
      // processed locally
      parsed = view2.parseGridId(data);
      //alert ( "cell :"+parsed.row+"_"+parsed.col );
      if (parsed.prefix=="p") {
        if ( model.playerBasin.get(parsed.row,parsed.col) != "s" ) c="s";
        else c="e";
        model.playerBasin.put(c,parsed.row,parsed.col);
        view2.pBoard.put(c,parsed.row,parsed.col);
      }
      break;
      
    case "rs": // remove all ships
      model.playerBasin.clear();
      view2.pBoard.fromBasin(model.playerBasin);
      break;

    case "as": // automatically draw ships
      sy=new ShipYard(global.getForces());
      ps=sy.buildAll();
      model.playerBasin.clear();
      model.playerBasin.takeShips(ps);
      view2.pBoard.fromBasin(model.playerBasin);
      break;
      
    case "cs": // check up and go playing
      h=new Harvester(model.playerBasin);
      h.search();
      model.playerBasin.cleanUp();
      view2.pBoard.fromBasin(model.playerBasin);
      hs=h.yield();
      model.playerShips = new Fleet();
      model.playerShips.take(hs);
      if ( ! model.playerShips.checkMargins() ) {
        view2.pMessage.put("Ships must be straight<br /> and not to touch each other. <br />Try new ones");
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
      //alert("active="+global.getActive());
      if (global.getActive()!==global.pSide) break;
      parsed = view2.parseGridId(data);
      //alert ( "cell : "+parsed.prefix+"_"+parsed.row+"_"+parsed.col );
      if ( parsed.prefix == "e" ) {
        c="f";
        view2.eBoard.put(c,parsed.row,parsed.col);
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
  var divisors={intro:3,rules:0,ships:1,fight:0,finish:3};// fires on divisor+1'th time 
  if ( typeof onPoll._i == "undefined" ) onPoll._i=0;
  var stage=global.getStage();
  var state=global.getState();
  
  if ( divisors[stage]<0 ) return;
  if ( onPoll._i < divisors[stage] ) {
    onPoll._i +=1;
    return;
  }
  onPoll._i = 0;
  
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
  if ( stage=="fight" && ( global.isActive(global.eSide) ) ) {
    tm.go("fight","queryMoves");
    return;
  }
  if ( stage=="finish" && ( state=="cycling" || state=="cyclingReq" || state=="cyclingOk" ) ) {
    tm.go("finish","queryStage");
    return;
  }
}

// AJAX response ready "event"
function onAjaxReceived(responseText) {
  // normal flow
  $("tech").innerHTML=" full response:<br />"+responseText;
  tm.pull(responseText);
}

