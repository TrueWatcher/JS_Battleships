"use strict";

function Game() {
  var _stage="zero";// private, wrappers are there
  var _stagesAllowed=["zero", "rules", "init", "ships", "fight", "finish"];
  this._active="p";// p e
  this._winner;

  this.forces1=[0,4,3,2,1,0,0,0,0,0,0];// public, used by RulesForm
  this.forces2=[0,0,1,1,1,1,0,0,0,0,0];// public, used by RulesForm
  var _forces;// wrapper is there
  var _strikes1="oe";
  var _strikes2="bs";
  this._strikeRule;
  var _level;
  this._demandEqualForces=1;
  this._previewEnemyShips=0;//0;//1;
  this._enemyStriker="harvester";// "random";
  this._theme="ascii";

  this.setRules=function(form) {
    var inp;
    this._playerName=getElementValue("playerName");
    this._enemyName=getElementValue("enemyName");
    putToElement(this._playerName,"playerLabel");
    putToElement(this._enemyName,"enemyLabel");

    if ( getElementValue("forces1","checked") ) _forces=this.forces1;
    else if ( getElementValue("forces2","checked") ) _forces=this.forces2;
    else throw ("Game::setRules: invalid forces");

    if ( getElementValue("strikes1","checked") ) this._strikeRule=_strikes1;
    else if ( getElementValue("strikes2","checked") ) this._strikeRule=_strikes2;
    else throw ("Game::setRules: invalid strikes");

    if ( getElementValue("level1","checked") ) _level=1;
    else if ( getElementValue("level2","checked") ) _level=2;
    else if ( getElementValue("level3","checked") ) _level=3;
    else throw ("Game::setRules: invalid level");
    switch (_level) {
      case 1:
        this._demandEqualForces=0;
        this._previewEnemyShips=1;
        this._enemyStriker="harvester";
        break;
      case 2:
        this._enemyStriker="random";
        break;
      case 3:
    }

    if ( getElementValue("theme1","checked") ) this._theme="icons1";
  };

  this.setStage=function(stage) {
    if (_stagesAllowed.indexOf(stage)<0 ) throw new Error("Game::setStage: invalid value "+stage);
    _stage=stage;
  };

  this.getStage=function() {
    return(_stage);
  };

  this.getForces=function() {
    return(_forces);
  };
}// end Game

var hit;// after DEBUG can be moved inside the go()

/**
 * Main controller
 * @uses View v
 * @uses Model m
 * @uses Game g
 * @uses PlayerAssistant p
 * @uses Enemy e
 * @uses Active a
 *
 * @param string command
 * @param array data
 * @return nothing
 */
function go(command,data) {
  var row,col,point,ship;
  var c,mes;
  var eh,sy,ps,h,hs,cm,ph,wh;

  switch (g.getStage()) {

    case "zero":
      toggleElement("general");// hide game field
      g.setStage("rules");
      return;

    case "rules":
      v.rf.toggle();// display rules form
      g.setRules();
      g.setStage("init");
      //return;
      // fall-through

    case "init":
      //alert("init");
      v.setBoards(g._theme);
      toggleElement("general");

      m.enemyShips=new Fleet();
      m.enemyShips.build("byWarrant",g.getForces());
      eh=m.enemyShips.makeHistogram();
      v.es.showClearHistogram(eh);
      m.enemyStat.setShips(eh);
      v.es.showStat(m.enemyStat.shipsAlive,m.enemyStat.biggestShip,m.enemyStat.shipsSunk);
      if (g._previewEnemyShips) {
        m.enemyShips.show(v.tb);
      }

      v.dc.toggle();// show Draw controls
      v.ps.toggle();
      v.es.toggle();
      mes="Draw your ships (";
      mes+=v.ps.showClearHistogram( g.getForces(),"return" );
      mes+="),<br />then press Done";
      v.pm.put(mes);
      g.setStage("ships");
      //return;
      // fall-through

    case "ships":

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
        if( ph.join()!=wh.join() ) {
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

        v.dc.toggle();// hide controls
        v.ps.toggle();
        v.es.toggle();        
        v.pm.add("<br />Make your move!");
        g.setStage("fight");

        e=new Enemy( m.enemyShips,m.enemyBasin,m.enemyStat,m.enemyClip,m.playerBasin,v.em,g._enemyStriker );
        //alert("E_hi="+e.hi());
        p=new PlayerAssistant( m.playerShips,m.playerBasin,m.playerStat,m.playerClip,v.pm );
        a=new Active(p,e,g);
        if (g._strikeRule=="bs") {
          p._clip.load();
          e._clip.load();
        }
      }
      return;

    case "fight":

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

    case "finish":

      if (g._active=="p") {
        g._winner="p";
        v.pm.put('<span class="'+"win"+'">YOU HAVE WON !');
      }
      else {
        g._winner="p";
        v.em.put('<span class="'+"lose"+'">ENEMY HAS WON !');
      }
      return;

    default: return;
  }// end switch
}// end go()

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
 * @param char responce
 * @param {object Stat} sourceStat
 * @return void
 * @see strikeResponce
 */
function strikeCount(responce,sourceStat) {
  sourceStat.addStrike();
  if ( responce =="h" || responce=="w" || responce=="f" ) sourceStat.addHit();
}

/**
 * Tells the View how to display a move.
 * @return void
 */
function displayResponce ( responce, probe, targetBoard, targetBasin, targetStatPanel, targetStat, sourceMesPanel ) {
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
    v.pb.put("f",probe[0],probe[1]);
    var t=window.setTimeout( function(){
      //alert("Enemy is striking");
      go("enemyStrike",probe);
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
 * Sub-unit of Controller, which manages order of moves and calls respective sides
 *
 * @constructor
 * @param object PlayerAssistant player
 * @param object Enemy enemy
 * @param object Game game
 */
function Active (player,enemy,game) {
  var _source=player;
  //var _game=game;
  var _letter=game._active;

  this.setPlayer=function() {
    _letter="p";
    _source=player;
  };

  this.setEnemy=function() {
    _letter="e";
    _source=enemy;
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
    var mes="",rem;
    if ( hit=="f" ) {
      game.setStage("finish");
      return false;
    }
    if (game._strikeRule=="bs") { // as many strikes as the size of biggest alive ship
      var rem=_source._clip.get();
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
    if ( game._strikeRule=="oe" ) { // one plus extra one for each hit
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
}