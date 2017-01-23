"use strict";

var hit;// after DEBUG can be moved inside the go()

function go(command,data) {
  alert ("Errror! Call to the global go()");
  return;
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
}