"use strict";
// utility functions
function $(id) {
  return( document.getElementById(id) );
}

function compareKeys(o1,o2,valsNotEmpty,valsEqual) {
  var k,v,j;
  if ( typeof valsNotEmpty==undefined ) valsNotEmpty=true;
  if ( typeof valsEqual==undefined ) valsEqual=false;
  for (k in o1) {
    if ( o1.hasOwnProperty(k) ) {
      if ( ! o2.hasOwnProperty(k) ) return ("Key in o1, not in o2 :"+k);
      if ( valsNotEmpty && ( !o1[k] || !o2[k] ) ) return ("Values for "+k+":"+o1[k]+"/"+o2[k]+"!");
      if ( valsEqual && o1[k] != o2[k] ) return ("Values for "+k+":"+o1[k]+"/"+o2[k]+"!");
    }
  }
  for (j in o2) {
    if ( o2.hasOwnProperty(j) ) {
      if ( ! o1.hasOwnProperty(j) ) return ("Key in o2, not in o1 :"+j);
    }
  }
  return true;
}

function TdIterator(tableElement) {

  if ( this.l ) { // prevent repeated instantiation
    this.i=0;
    return this;
  }
  
  this.list=tableElement.querySelectorAll("td[id]"); //makeList( tableElement );

  function makeList(parent) {
    var list=[];
    list=parent.querySelectorAll("td[id]");
    return list;
  }
  
  this.l=this.list.length;
  this.i=0;
  
  this.go=function() {
    var ret=false;
    if ( this.i >= this.l ) {
      this.i=0;
      return false;
    }
    ret=this.list[ this.i ];
    this.i+=1;
    return ret;
  }
}


function detectTd(event) {
  event = event || window.event;
  var target = event.target || event.srcElement;

  while(target.nodeName != 'TABLE') {
    if (target.nodeName == 'TD') { return (target.id); }
    target = target.parentNode;
  }
  return (false);
}

function readCookie(name) {
// http://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

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

// timer utility
function Poll(millisecs) {
  if ( !millisecs ) millisecs=10000;
  this.handler=null;
  var _this=this;
  
  this.start=function() {
    if (!this.handler) {
      this.handler=window.setInterval(onPoll,millisecs);
      //alert("Poller started");
    }
  }
  
  this.stop=function() {
    //alert("Poller stopped");
    window.clearInterval(this.handler);
    this.handler=null;
  }
}

// AJAX utilities
function sendRequest (queryString) {
  if (!queryString) throw new Error ("sendRequest: empty query string");
  var responderUrl="hub.php";

  //alert("Request to be sent to "+responderUrl+"?"+queryString);
  //return false;
  
  var req=new XMLHttpRequest();
  
  //req.open("GET",responderUrl+"?"+queryBase+"&"+queryString); // GET
  req.open("POST",responderUrl,true); // POST
  
  req.setRequestHeader("Content-Type","application/x-www-form-urlencoded");// for POST; should go _after_ req.open!
  
  req.onreadystatechange=function () { receive(req); };// both
  
  //var q=req.send(null); // GET
  var q=req.send(queryString); // POST
  
  //$("noteIntro").innerHTML="Connecting ...";
}

function receive(oReq) {
  var note="";
  if (oReq.readyState == 4) {
    if(oReq.status==200) {
      var rt=oReq.responseText;
      onAjaxReceived(rt);
    }
  }
}

function Global() {     
  this.online="online";
  var _stage="zero";
  var _stagesAllowed=["zero", "intro", "rules", "init", "ships", "fight", "finish","aborted"];
  var _statesAllowed=["zero","connecting", "picking", "confirming", "converged", "aborted", "finish", "ships","init"];
  var _state="zero";
  this.pSide="";
  this.pName="";
  this.eSide="";
  this.eName="";
  this.namesPE={};
  this.namesAB={};
  this._theme="ascii";
  this.message="";
  this.picks={};
  this.defaultPicks={"firstMove":0,"forces":0,"strikeRule":0,"level":0};
  this.picksObj={};
  this.picksStr="";
  this.page2loaded=0;
  
  this._active="p";// p e
  this._activeAB="A";
  //this._letter="p";
  this._winner;
  this.forces1=[0,4,3,2,1,0,0,0,0,0,0];// public, used by RulesForm
  this.forces2=[0,0,1,1,1,1,0,0,0,0,0];// public, used by RulesForm
  var _forces=this.forces1;// wrapper is there
  var _strikes1="oe";
  var _strikes2="bs";
  this._strikeRule=_strikes1;
  var _level=0;// 0 full, 1 easy, 2 cheat
  this._demandEqualForces=1;
  this._previewEnemyShips=0;//0;//1;
  this._enemyStriker="harvester";// "random";
  this._theme="ascii";  
  
  this.otherSide=function(side) {
    if (side=="A") return ("B");
    if (side=="B") return ("A");
    throw new Error("otherSide: wrong argument:"+side+"!");
  }
  
  this.setStage=function(stage) {
    if (_stagesAllowed.indexOf(stage)<0 ) throw new Error("Global::setStage: invalid value "+stage);
    _stage=stage;
    return(_stage);
  };

  this.getStage=function() {
    return(_stage);
  };
  
  this.setState=function(state) {
    if (_statesAllowed.indexOf(state)<0 ) throw new Error("Global::setState: invalid value "+state);
    _state=state;
    return(state);
  };

  this.getState=function() {
    return(_state);
  };
  
  this.setNames=function(pn,en) {
    if (!pn || !en || pn==en) throw new Error("Global::setNames: empty or equal argument(s)");
    this.pName=pn;
    this.eName=en;
    this.namesPE={"p":pn,"e":en};
    
  };
  
  this.getName=function(side) {
     if (side=="p") return this.pName;
     if (side=="e") return this.eName;
     if ( side == this.pSide ) return this.pName;
     if ( side == this.eSide ) return this.eName;
     throw new Error ("getName: unknown side:"+side+"!");
  }
  
  this.clearNames=function() {
    this.pName=this.eName="";
    this.names={};    
  };
  
  this.getForces=function() {
    return(_forces);
  };
  
  this.setRules=function(picksStr) {
    //alert("setRules "+picksStr);
    var picks=JSON.parse(picksStr);
    var ck=compareKeys(this.defaultPicks,picks);
    if ( true !== ck ) throw new Error("setRules: "+ck);
    if ( picks.firstMove === 1 ) {
      this._active="e";
      this._activeAB="B";
    }
    else { if( picks.firstMove !== 0 ) throw new Error("setRules:invalid firstMove="+picks.firstMove) }
    if ( picks.forces === 1 ) _forces=this.forces2;
    else { if( picks.forces !== 0 ) throw new Error("setRules:invalid forces="+picks.forces) }
    if ( picks.strikeRule === 1 ) this._strikeRule=_strikes2;
    else { if( picks.strikeRule !== 0 ) throw new Error("setRules:invalid strikeRule="+picks.strikeRule) }
    if ( picks.level ===1 ) _level=1;
    else if ( picks.level ===2 ) _level=2;
    else { if( picks.level !== 0 ) throw new Error("setRules:invalid level="+picks.level) }
    switch (_level) {
      case 2:
        this._demandEqualForces=0;
        this._previewEnemyShips=1;
        this._enemyStriker="harvester";
        break;
      case 1:
        this._enemyStriker="random";
        break;
      case 0:
    }
    
    this.picksObj=picks;
  };
  
  this.exportRules=function() {
    var r={
      firstActiveAB:this._activeAB, forces:_forces, strikeRule:this._strikeRule, demandEqualForces:this._demandEqualForces, previewEnemyShips:this._previewEnemyShips
    };
    return (JSON.stringify(r));
  }
}

function TopManager() {
  var stageControllers = { "local":{ "intro":Intro, "rules":RulesLocal, "ships":ShipsLocal, "fight":FightLocal, "finish":FinishLocal },
                          "online":{"intro":Intro,"rules":RulesOnline} };
  
  function getStageController(aOnline,aStage) {
    if ( !aStage || aStage=="zero" ) aStage="intro";
    var sc = stageControllers [aOnline] [aStage];
    if (!sc) throw new Error ("Failed to find the stage controller for "+aOnline+" and "+aStage+"!");
    return sc;
  }
  
  var stage,state,currentStage,currentState;
  var responseObj={};
  
  /**
    * Main entry point to every controller affair.
    */
  this.go=function(aStage,command,data) {
    var stage=g.getStage();
    if( stage=="zero" ) stage=g.setStage("intro");
  
    if ( aStage!==stage && command!=="queryFull" && command!=="queryPick" && command!=="abort" ) { 
      alert("Command ("+command+") stage is "+aStage+", global is "+stage+"!");
      return false;
    }
    var Sc=getStageController(g.online,aStage);
    var sc=new Sc();
    //sc=new Intro();
    var r = sc.go(command,data);
  };
  
  this.pull=function(responseText) {
    $("tech").innerHTML=" full response:<br />"+responseText;
    responseObj=JSON.parse(responseText);
    var stateChanged=adoptState(responseObj);
    if (stateChanged) onStateChange(responseObj,currentStage,stage,currentState,state);
    v1.consumeServerResponse(responseObj);
  };
    
  function adoptState(responseObj) {
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
  
  function onStateChange(responseObj,prevStage,stage,prevState,state) {
    if ( responseObj["players"] ) onRegistration();
    if ( stage == "ships" ) { onFinished(); return; }
    if ( stage == "over" || stage == "aborted" ) { onFinished(); return; }
    if ( (prevStage == "intro" || prevStage == "zero") && stage == "rules" ) { 
      v1.clearNote("intro");
      v1.initPicks();
      //onRegistration();
      return;
    }
    /*if ( stage == "intro" && prevState=="zero" && state=="connecting" ) { 
      onRegistration();
      return;
    }*/
  }
  
  // registration "event"
  function onRegistration() {    
    g.pSide=readCookie("side");
    g.pName=readCookie("name");
    g.eSide=g.otherSide(g.pSide);
    //alert("cookies side="+g.pSide+", name="+ng.pName+".");
    if ( responseObj["players"] ) {
      //processRegistration();
      var rp=responseObj["players"];
      //v1.putNames(rp["A"],rp["B"]);
      if ( rp[g.pSide] != g.pName ) throw new Error("My name is "+g.pName+" in the cookie and "+rp[g.pSide]+" in the response!");
    }
    v1.ticks[g.pSide]="v";
    v1.ticks[g.eSide]="x";
    poller.start();
    //v1.initPicks();// makes problems
    v1.putNote("intro"," connected ");
  }

  // deal finish "event"
  function onFinish() {
    //alert("FIN");
    poller.stop();// there will be one last call
  }
}

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
      g.online="local";
      g._theme=v1.applyTheme();
      names=v1.getNames();
      g.setNames( names.p, "Local Script" );//names.e);
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
    case "queryFull":        
      sendRequest("intro=queryFull");
      break;
    default:
      throw new Error("Intro::go: unknown command:"+command+"!");
    }
  };
}

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
      qs="rules=confirm&pick="+myPicks;
      sendRequest(qs);
      break;
    default:
      throw new Error("RulesOnline::go: unknown command:"+command+"!");
    }      
  };  
}

function RulesLocal() {

  this.go=function(command,data) {
    //alert("RulesLocal "+command);
    var myPicks="";
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
        // copy picked items to enemy side
        v1.drawPicks("B",myPicks,v1.ticks["B"]);
      }
      //alert("myPicks:"+myPicks);
      // g.setState("converged");
      break;
    case "queryPick":
      alert("Command queryPick while playing locally");
      break;
    case "confirm":
      myPicks=v1.readPicks(g.pSide);
      //alert("myPicks:"+myPicks);
      if ( true !== compareKeys( JSON.parse(myPicks), g.defaultPicks ) ) { 
        alert ("Please, give all answers");
        break;
      }
      v1.putNote("rules","Done");
      g.pickStr=myPicks;
      g.setRules(myPicks);
      g.setStage("ships");
      //g.setState("draw");
      this.initPage2();
      break;
    default:
      throw new Error("RulesOnline::go: unknown command:"+command+"!");
    }
  };
  
  this.initPage2=function() {
    v1.putNote("rules","Loading page 2");
    //alert("Running page 2");
    //g=g;//new Game();
    
    if(typeof v !=="object") alert("onTransitToPage2: v is not the global object");
    if(typeof m !=="object") alert("onTransitToPage2: m is not the global object");
    v=new View(g);
    m=new Model();      

    v.setBoards(g._theme);
    v.putNames();
    //toggeElement("general");

    m.enemyShips=new Fleet();
    m.enemyShips.build("byWarrant",g.getForces());
    var eh=m.enemyShips.makeHistogram();
    v.es.showClearHistogram(eh);
    m.enemyStat.setShips(eh);
    v.es.showStat(m.enemyStat.shipsAlive,m.enemyStat.biggestShip,m.enemyStat.shipsSunk);
    if (g._previewEnemyShips) {
      m.enemyShips.show(v.tb);
    }

    //v.dc.toggle();// show Draw controls
    //v.ps.toggle();
    //v.es.toggle();
    var mes="Draw your ships (";
    mes+=v.ps.showClearHistogram( g.getForces(),"return" );
    mes+="),<br />then press Done";
    v.pm.put(mes);
    g.setStage("ships");
    return;
  }
}

function ShipsLocal() {

  this.go=function(command,data) {
    var c,sy,ps,h,hs,cm,ph,wh,mes="";

    if (command=="cs" || command=="as") v.pm.put("");
    if( command=="set" && data.length==2 ) { // set a square to ship or empty
      if ( m.playerBasin.get(data) != "s" ) c="s";
      else c="e";
      m.playerBasin.put(c,data);
      v.pb.put(c,data);
    }

    if( command=="rs") { // remove all ships
      m.playerBasin.clear();
      v.pb.fromBasin(m.playerBasin);
    }

    if( command=="as") { // automatically draw ships
      sy=new ShipYard(g.getForces());
      ps=sy.buildAll();
      m.playerBasin.clear();
      m.playerBasin.takeShips(ps);
      v.pb.fromBasin(m.playerBasin);
    }

    if( command=="cs") { // check up and go playing
      h=new Harvester(m.playerBasin);
      h.search();
      m.playerBasin.cleanUp();
      v.pb.fromBasin(m.playerBasin);
      hs=h.yield();
      m.playerShips = new Fleet();
      m.playerShips.take(hs);
      cm=m.playerShips.checkMargins();
      if (!cm) {
        v.pm.put("Ships must be straight<br /> and not to touch each other. <br />Try new ones");
        m.playerShips.clear();
        return;
      }
      ph=m.playerShips.makeHistogram();
      wh=g.getForces();
      if( ph.join() != wh.join() ) {
        mes="The rules require <br />(squares:ships): ";
        mes+=v.ps.showClearHistogram(wh,"return");
        mes+='<br />Your ships does not comply';
        if ( g._demandEqualForces ) mes+="<br />Try new ones";
        v.pm.put( mes );
        if ( g._demandEqualForces ) {
          m.playerShips.clear();
          return;
        }
      }

      m.playerStat.setShips(ph);
      v.ps.showStat(m.playerStat.shipsAlive,m.playerStat.biggestShip,m.playerStat.shipsSunk);
      v.ps.showClearHistogram(ph);

      //v.dc.toggle();// hide controls
      //v.ps.toggle();
      //v.es.toggle();        
      
      g.setStage("fight");
      
      if( typeof e != "object") throw new Error("ShipsLocal::go: e is not the global object!");
      if( typeof p != "object") throw new Error("ShipsLocal::go: p is not the global object!");
      if( typeof a != "object") throw new Error("ShipsLocal::go: a is not the global object!");
      
      e=new Enemy( m.enemyShips, m.enemyBasin, m.enemyStat, m.enemyClip, m.playerBasin, v.em, g._enemyStriker );
      //alert("E_hi="+e.hi());
      p=new PlayerAssistant( m.playerShips, m.playerBasin, m.playerStat, m.playerClip, v.pm );
      a=new Active(p,e,g);
      if (g._strikeRule=="bs") {
        p._clip.load();
        e._clip.load();
      }
      
      if (g._active=="p") {
        v.pm.add("<br />Make your move!"); 
        a.setPlayer();
      }
      else if (g._active=="e" ) { 
        v.em.add("Enemy has first move");
        a.setEnemy();
        e.strike();
      } 
      else throw new Error ("Invalid active side:"+g._active+"!");
    }
    return;
  };
}

function FightLocal() {
  
  this.go=function(command,data) {
    //if ( g._active=="p" && command=="enemyStrike" ) alert ("Wrong timed command "+command+"(hit="+hit+")");
    //if ( g._active=="e" && command=="strike" ) alert ("Wrong timed command "+command+"(hit="+hit+")");

    v.pm.put("");
    v.em.put("");
    if( g._active=="p" && command=="strike" && data.length==2 ) {
      hit=e.respond(data);
      p.reflect(hit);
      v.ps.showStrikesHits(m.playerStat.strikes,m.playerStat.hits);
      displayResponce( hit, data, v.tb, m.enemyBasin, v.es, m.enemyStat, v.pm );// e.display
      if ( a.checkout(hit) ) return;
      // fall-through
    }

    if ( g._active=="e" && command=="enemyStrike" && data.length==2 ) {
      hit=p.respond(data);
      e.reflect(hit);
      v.es.showStrikesHits(m.enemyStat.strikes,m.enemyStat.hits);
      displayResponce( hit, data, v.pb, m.playerBasin, v.ps, m.playerStat, v.em );//p.display
      if (hit=="n")
        console.log( "Enemy repeats itself on "+data+" that is "+v.playerBasin.get(data[0],data[1]) );// this is not to happen
      if ( a.checkout(hit) ) return;
      // fall-through
    }
    if ( g.getStage()!="finish" ) { // some command out of order
      console.log( "Out of order: player="+g._active+" command="+command+" data="+data+" stage="+g.getStage() );
      return;
    }
    // fall-through

    //g.getState() == "finish":
    if (g._active=="p") {
      g._winner="p";
      v.pm.put('<span class="'+"win"+'">YOU HAVE WON !');
    }
    else {
      g._winner="e";
      v.em.put('<span class="'+"lose"+'">ENEMY HAS WON !');
    }
    return;    
  }
}

function FinishLocal() {
  this.go=function(command,data) {
    switch (command) {
    case "quit":
      window.close();
      alert("You may close the browser window at any time");
      break;
    case "more":
      //alert("g._active="+g._active);
      // Active::swap leaves g._active=winning side
      var rl=new RulesLocal();
      rl.initPage2();
      break;
    case "new":
      g=new Global();
      g.setStage("intro");
      g.setState("zero");
      break;
    }
  }
  
}

// timer "event"
function onPoll() { tm.go("rules","queryPick"); }

// AJAX response ready "event"
function onAjaxReceived(responseText) { tm.pull(responseText); }

