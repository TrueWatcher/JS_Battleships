"use strict";

//var hit;// after DEBUG can be moved inside the go()

/**
 * Subcontroller for the Rules stage.
 * @constructor
 */
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
      details=view1.parsePickId(id);
      if ( details.side==global.pSide ) {
        view1.clearGroup(details.itemName, details.row, details.side);
        view1.tickHtml(id);
        myPicks=view1.readPicks(global.pSide);
        // copy picked items to enemy side
        view1.drawPicks("B",myPicks,view1.ticks["B"]);
      }
      //alert("myPicks:"+myPicks);
      // global.setState("converged");
      break;
    case "queryPick":
      alert("Command queryPick while playing locally");
      break;
    case "confirm":
      myPicks=view1.readPicks(global.pSide);
      //alert("myPicks:"+myPicks);
      if ( true !== compareKeys( JSON.parse(myPicks), global.defaultPicks ) ) { 
        alert ("Please, give all answers");
        break;
      }
      view1.putNote("rules","Done");
      global.pickStr=myPicks;
      global.setRules(myPicks);
      //global.setStage("ships");
      //global.setState("ships");
      this.initPage2();
      break;
    default:
      throw new Error("RulesOnline::go: unknown command:"+command+"!");
    }
  };
  
  this.initPage2=function() {
    view1.putNote("rules","Loading page 2");
    //alert("Running page 2");
    //g=g;//new Game();
    
    if(typeof view2 !=="object") alert("initPage2: view2 is not the global object");
    if(typeof model !=="object") alert("initPage2: model is not the global object");
    view2=new View(global);
    model=new Model();      
    
    view2.setBoards(global._theme);
    view2.putNames();
    view2.pMessage.put("");
    view2.eMessage.put("");
    
    if (global.allowHideControls) { 
      hideElement("intro");
      hideElement("rules");
      hideElement("finish");
    }
    displayElement("main");
    view2.drawButtons.display();

    model.enemyShips=new Fleet();
    model.enemyShips.build("byWarrant",global.getForces());
    var eh=model.enemyShips.makeHistogram();
    view2.eStat.showClearHistogram(eh);
    model.enemyStat.setShips(eh);
    view2.eStat.showStat(model.enemyStat.shipsAlive,model.enemyStat.biggestShip,model.enemyStat.shipsSunk);
    if (global._previewEnemyShips) {
      model.enemyShips.show(view2.eBoard);
    }

    var mes="Draw your ships (";
    mes+=view2.pStat.showClearHistogram( global.getForces(),"return" );
    mes+="),<br />then press Done";
    view2.pMessage.put(mes);
    global.setStage("ships");
    global.setState("ships");
    return;
  };
}

/**
 * Subcontroller for the Ships stage.
 * @constructor
 */
function ShipsLocal() {

  this.go=function(command,data) {
    var c,sy,ps,h,hs,cm,pHistogram,warrantHistogram,mes="";
    var parsed={};
    //alert(command+"+"+data);
    
    if ( command=="cs" || command=="as" ) view2.pMessage.put("");
    
    if ( command=="cell" && data ) { // set a square to ship or empty
      parsed = view2.parseGridId(data);
      //alert ( "cell :"+parsed.row+"_"+parsed.col );
      if (parsed.prefix=="p") {
        if ( model.playerBasin.get(parsed.row,parsed.col) != "s" ) c="s";
        else c="e";
        model.playerBasin.put(c,parsed.row,parsed.col);
        view2.pBoard.put(c,parsed.row,parsed.col);
      }
    }

    if (command=="rs") { // remove all ships
      model.playerBasin.clear();
      view2.pBoard.fromBasin(model.playerBasin);
    }

    if (command=="as") { // automatically draw ships
      sy=new ShipYard(global.getForces());
      ps=sy.buildAll();
      model.playerBasin.clear();
      model.playerBasin.takeShips(ps);
      view2.pBoard.fromBasin(model.playerBasin);
    }

    if (command=="cs") { // check up and go playing
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
      pHistogram=model.playerShips.makeHistogram();
      warrantHistogram=global.getForces();
      if ( pHistogram.join() != warrantHistogram.join() ) {
        mes="The rules require <br />(squares:ships): ";
        mes+=view2.pStat.showClearHistogram(warrantHistogram,"return");
        mes+='<br />Your ships do not comply';
        if ( global._demandEqualForces ) mes+="<br />Try new ones";
        view2.pMessage.put( mes );
        if ( global._demandEqualForces ) {
          model.playerShips.clear();
          return;
        }
      }

      model.playerStat.setShips(pHistogram);
      view2.pStat.showStat(model.playerStat.shipsAlive,model.playerStat.biggestShip,model.playerStat.shipsSunk);
      view2.pStat.showClearHistogram(pHistogram);
      if (global.allowHideControls) { view2.drawButtons.hide(); }
      initFight();
    }
    return;
  };
  
  function initFight() {
    if( typeof enemy != "object" ) throw new Error("ShipsLocal::go: enemy is not the global object!");
    if( typeof player != "object" ) throw new Error("ShipsLocal::go: player is not the global object!");
    if( typeof arbiter != "object" ) throw new Error("ShipsLocal::go: arbiter is not the global object!");
    
    global.setStage("fight");
    global.setState("fight");
    
    enemy=new Enemy( model.enemyShips, model.enemyBasin, model.enemyStat, model.enemyClip, model.playerBasin, view2.eMessage, global._enemyStriker );
    //alert("E_hi="+enemy.hi());
    player=new PlayerAssistant( model.playerShips, model.playerBasin, model.playerStat, model.playerClip, view2.pMessage );
    arbiter=new Arbiter(player,enemy,global);
    if (global._strikeRule=="bs") {
      player._clip.load();
      enemy._clip.load();
    }
    
    if (global._active=="p") {
      view2.pMessage.add("<br />Make your move!"); 
      arbiter.setPlayer();
    }
    else if (global._active=="e" ) { 
      view2.eMessage.add("Enemy has first move");
      arbiter.setEnemy();
      enemy.strike();
    } 
    else throw new Error ("Invalid active side:"+global._active+"!");    
  }
}

/**
 * Subcontroller for the Fight stage.
 * @constructor
 */
function FightLocal() {
  
  this.go=function(command,data) {
    var hit;
    var parsed={};

    view2.pMessage.put("");
    view2.eMessage.put("");
    
    // player's strike
    if( global._active=="p" && command=="cell" && data ) {
      parsed = view2.parseGridId(data);
      if ( parsed.prefix != "e" ) return;
      hit=enemy.respond([parsed.row,parsed.col]);
      //alert(">"+hit);
      player.reflect(hit);
      view2.pStat.showStrikesHits(model.playerStat.strikes,model.playerStat.hits);
      displayResponce( hit, [parsed.row,parsed.col], view2.eBoard, model.enemyBasin, view2.eStat, model.enemyStat, view2.pMessage );// enemy.display
      if ( arbiter.checkout(hit) ) return;
      // fall-through
    }
    
    // LocalScript's strike
    if ( global._active=="e" && command=="enemyStrike" && data.length==2 ) {
      hit=player.respond(data);
      enemy.reflect(hit);
      view2.eStat.showStrikesHits(model.enemyStat.strikes,model.enemyStat.hits);
      displayResponce( hit, data, view2.pBoard, model.playerBasin, view2.pStat, model.playerStat, view2.eMessage );//player.display
      if (hit=="n")
        console.log( "Enemy repeats itself on "+data+" that is "+model.playerBasin.get(data[0],data[1]) );// this is not to happen
      if ( arbiter.checkout(hit) ) return;
      // fall-through
    }
    
    if ( global.getStage()!="finish" ) { // some command out of order
      console.log( "Out of order: player="+global._active+" command="+command+" data="+data+" stage="+global.getStage() );
      return;
    }
    // fall-through

    // fight finished
    displayElement("finish");
    global.setState("finish");
    if (global._active=="p") {
      global._winner="p";
      view2.pMessage.put('<span class="'+"win"+'">YOU HAVE WON !');
    }
    else {
      global._winner="e";
      view2.eMessage.put('<span class="'+"lose"+'">ENEMY HAS WON !');
    }
    return;    
  };
}

/**
 * Subcontroller for the Finish stage.
 * @constructor
 */
function FinishLocal() {
  
  this.go=function(command,data) {
    
    switch (command) {
      
    case "quit":
      window.close();
      alert("You may close the browser window at any time");
      break;
      
    case "more":
      //alert("global._active="+global._active);
      // Active::swap leaves global._active equal to the winning side
      var rl=new RulesLocal();
      rl.initPage2();// call existing subcontroller's init routine
      break;
      
    case "new":
      global=new Global();
      global.allowHideControls=true;
      global.setStage("intro");
      global.setState("zero");
      if (global.allowHideControls) { 
        hideElement("main");
        hideElement("finish");
      }
      displayElement("intro");
      displayElement("rules");
      break;
    }
  };  
}

/**
 * Generates a random move.
 * @param object Basin targetBasin
 * @param object Rand2d randGen
 * @return array [row,column]
 */
function randomStrike(targetBasin,randGen) {
  var probe=randGen.go();
  while ( ! targetBasin.checkStrikable(probe) ) { probe=randGen.go(); }
  return (probe);
}

/**
 * Checks an opponent's move against own Fleet and Basin
 * @param array probe
 * @param object Fleet fleet
 * @param object Basin ownBasin
 * @param object Stat stat
 * @return string n-wrong move,m-miss,h-hit,w-killed,f-finished
 * @see Fleet::checkHit
 * @see Basin::checkSunk
 */
function strikeResponce(probe,fleet,ownBasin,stat) {
  var hit;
  if ( !ownBasin.checkStrikable(probe) ) return ("n");// wrong strike
  hit=fleet.checkHit(probe);// hit is false or striken ship
  if ( hit===false ) { // miss
    ownBasin.put("m",probe);
    return ("m");
  }
  ownBasin.put("h",probe);
  if ( ownBasin.checkSunk(hit)===false ) { return ("h"); } // hit but not sunk
  // sunk
  ownBasin.markSunk(hit);
  ownBasin.markAround(hit);
  if ( stat.minusOne(hit) ) { return ("f"); }
  return  ("w");
}

/**
 * Updates statistics on the active side.
 * @param char response
 * @param {object Stat} sourceStat
 * @return void
 * @see strikeResponce
 */
function strikeCount(response,sourceStat) {
  sourceStat.addStrike();
  if ( response =="h" || response=="w" || response=="f" ) sourceStat.addHit();
}

/**
 * Tells the View how to display a move.
 * @return void
 */
function displayResponce ( responce, probe, targetBoard, targetBasin, targetStatPanel, targetStat, sourceMesPanel ) {
  if ( probe.length!==2 ) throw new Error ("Invalid probe:"+probe+"!");
  if ( responce=="n" ) {
    sourceMesPanel.add("Strike on already marked square "+probe[0]+probe[1]);
    return;
  }
  if ( responce=="h" || responce=="m" ) {
    targetBoard.put(responce,probe);
    return;
  }
  if ( responce=="w" || responce=="f" ) {
    targetBoard.fromBasin(targetBasin);
    targetStatPanel.showStat(targetStat.shipsAlive,targetStat.biggestShip,targetStat.shipsSunk);
    return;
  }
}

/**
 * A side of fighting that represents enemy.
 * @constructor
 * @method strike
 * @method respond
 * @method reflect
 */
function Enemy (fleet,ownBasin,stat,clip,targetBasin,mesPanel,strikeMode) {
  var _this=this;
  this._fleet=fleet;
  this._ownBasin=ownBasin;
  this._targetBasin=targetBasin;
  this._stat=stat;
  this._clip=clip;
  this._mesPanel=mesPanel;
  this._striker={};// must have methods: move, reflect
  //this._mode=mode;

  if (strikeMode=="harvester") this._striker=new Harvester(targetBasin);
  else { // construct a random striker
    this._rand=new Rand2d();
    this._striker.move=function() { return( randomStrike(_this._targetBasin,_this._rand) ); };
    this._striker.reflect=function(responce) {};
  }

  this.strike=function() {
    //var probe=randomStrike(this._targetBasin,this._rand);
    var probe=_this._striker.move();
    view2.pBoard.put("f",probe[0],probe[1]);
    var t=window.setTimeout( function(){
      //alert("Enemy is striking");
      tm.go("fight","enemyStrike",probe);
    }, 200 );
  };

  this.respond=function (probe) {
    return ( strikeResponce ( probe, this._fleet, this._ownBasin, this._stat ) );
  };

  this.reflect=function (responce) {
    this._striker.reflect(responce);
    strikeCount ( responce, this._stat );
    this._clip.dec();
  };
}

/**
 * A side of fighting that represents player.
 * @constructor
 * @method strike
 * @method respond
 * @method reflect
 */
function PlayerAssistant (fleet,ownBasin,stat,clip,mesPanel) {
  this._fleet=fleet;
  this._ownBasin=ownBasin;
  this._stat=stat;
  this._clip=clip;
  this._mesPanel=mesPanel;
  //this.rand=new Rand2d();

  this.strike=function() {};

  this.respond=function (probe) {
    return ( strikeResponce ( probe, this._fleet, this._ownBasin, this._stat ) );
  };

  this.reflect=function (responce) {
    strikeCount( responce, this._stat );
    this._clip.dec();
  };
}

/**
 * Sub-unit of Controller, which manages order of moves and calls respective sides.
 *
 * @constructor
 * @param object PlayerAssistant aPlayer
 * @param object Enemy aEnemy
 * @param object Game game
 */
function Arbiter (aPlayer,aEnemy,game) {
  var _source=aPlayer;
  //var _game=game;
  var _letter=game._active;

  this.setPlayer=function() {
    _letter="p";
    _source=aPlayer;
  };

  this.setEnemy=function() {
    _letter="e";
    _source=aEnemy;
  };

  this.swap=function() {
    if (_letter=="p") this.setEnemy();
    else if (_letter=="e") this.setPlayer();
    else throw new Error("Active::swap: wrong letter");
    game._active=_letter;
  };

  /**
   * Checks hit and other parameters, changes game state (active side, stage), calls strike() for a new move
   * Supports two game modes (defined by Game._strikeRule)
   *
   * @param char hit value from last respond()
   * @return boolean false if game is finished, true if not finished
   */
  this.checkout=function(hit) {
    //alert("call to checkout()");
    var mes="",rem;
    if ( hit=="f" ) {
      game.setStage("finish");
      return false;
    }
    var gs=game._strikeRule;
    if ( gs!="bs" && gs!="oe" ) throw new Error ("checkout: unknown strike rule:"+gs+"!");
    if ( gs=="bs" ) { // as many strikes as the size of biggest alive ship
      var rem =_source._clip.get();
      if (rem) {
        //alert (rem+" strikes remain");
        _source._mesPanel.add ( rem+" strikes remain" );
        _source.strike();
        return true;
      }
      else {
        //alert ("It was a "+this._letter+"'s move");
        this.swap();
        //alert ("Now it's a "+this._letter+"'s move");
        rem=_source._clip.load();
        _source._mesPanel.add ( "Firepower is "+rem+" strikes" );
        _source.strike();
        return true;
      }
    }
    if ( gs=="oe" ) { // one plus extra one for each hit
      if( hit=="m" || hit=="n" ) {
        //alert ("It was a "+this._letter+"'s move");
        this.swap();
        //alert ("Now it's a "+this._letter+"'s move");
        _source.strike();
        return true;
      }
      if ( hit=="h" || hit=="w" ) {
        //alert (this._letter+" has an extra move");
        if (_letter=="p") mes="You've hit the enemy. Make an ";
        else mes="Enemy has an ";
        _source._mesPanel.add ( mes+"extra move" );
        _source.strike();
        return true;
      }
    }
  };// end checkout
  
  this.getActiveSideObj=function() { return(_source); };
}