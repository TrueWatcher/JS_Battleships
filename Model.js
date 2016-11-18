'use strict';

function Model() {
  this.playerBasin=new Basin();
  this.enemyBasin=new Basin("public");

  this.playerShips={};
  this.enemyShips={};

  this.playerStat=new Stat();
  this.enemyStat=new Stat();

  this.playerClip=new Clip(this.playerStat);
  this.enemyClip=new Clip(this.enemyStat);
}

/**
 * A class to build ships according to a list of sizes/quantities.
 * @constructor
 * @param array hist An array shipsSize=>shipQuantity, normally [0,4,3,2,1,0,0,0,0,0,0]
 * @see Fleet::makeHistogram
 */
function ShipYard(hist) {
  var _ships=[];// private
  var _rand=new Rand2d();// private

  /**
   *
   * @param array rc starting point [row,column]
   * @param integer decks size
   * @param boolean rowOrCol true to build horizontally, false -- vertically
   * @return {array|boolean} new ship as array of points or false on failure
   * @private
   */
  function tryBuildShip(rc,decks,rowOrCol) {
    var ship=[];
    var row=rc[0];
    var col=rc[1];
    var rcc;
    var l;
    if ( !rowOrCol && ( row+decks>=DIM ) ) return(false);
    if ( rowOrCol && ( col+decks>=DIM ) ) return(false);
    for( l=0;l<decks;l++ ){
      if(rowOrCol) {
        //fix row
        rcc=[ row,(col+l) ];
      }
      else {
        //fix col
        rcc=[ (row+l),col ];
      }
      ship.push(rcc);
    }
    return(ship);
  };

  /**
   * Checks a given ship for collisions or contacts with existing ships.
   * @param array newShip
   * @param boolean skipCheckMargin true to check only for collisions and allow contacts (for tests)
   * @return boolean false if problem is detected
   * @private
   */
  function trySail(newShip,skipCheckMargin) {
    var rc,i,j;
    var ship=[];
    var checkMargin=true;
    if (skipCheckMargin) checkMargin=false;
    var aroundNew=around(newShip);
    for( i=0; i<_ships.length; i++ ) {
      ship=_ships[i];
      for( j=0; j<ship.length; j++ ) {
        rc=ship[j];
        if ( (newShip.indexOfVect(rc)>=0) || (checkMargin && aroundNew.indexOfVect(rc)>=0) ) return(false);
      }
    }
    return (true);
  };

  /**
   * Runs tryBuildShip and trySail in a cycle until success.
   * @param integer decks
   * @private
   */
  function buildAndSail(decks) {
    var rc=_rand.go();
    var rc2=_rand.go();
    var ship=[];
    while ( false === ( ship=tryBuildShip(rc,decks,(rc2[0]>rc2[1]) ) ) || false === trySail(ship) ) {
      rc=_rand.go();
      rc2=_rand.go();
    }
    _ships.push(ship);
  };

  /**
   * Runs buildAndSail until the plan is fulfiled.
   * @return array New ships, checked and ready to fight
   */
  this.buildAll=function() {
    var i,decks=DIM+1;
    while ( !hist[--decks] ) {};// skip zeroes
    while ( hist[decks]>0 && decks>0 ) {
      for ( i=0; i<hist[decks]; i++ ) {
        buildAndSail(decks);
      }
      decks--;
    }
    return(_ships);
  };
}// end ShipYard

/**
 * A part of Model that manages ships. There are some operations that require ships list instead of battlefield.
 * @constructor
 */
function Fleet() {
  this._ships=[];

  /**
   *
   * @param string mode Actually should be "byWarrant", others are for tests
   * @param array plan A histogram to be passed to ShipYard
   * @return nothing
   * @see ShipYard
   */
  this.build=function (mode,plan) {
    var ship=[];
    var rc;
    var range={},rand={},allPoints=[],sy={};
    var i;

    switch (mode) {
      case "random20by1":
        rand=new Rand2d();
        for (i=0;i<20;i++) {
          while ( allPoints.indexOfVect( rc=rand.go() ) >= 0 ) {};
          allPoints.push(rc);
          ship=[ rc ]; // one square
          this._ships.push(ship);
        }
        break;
      case "fromPrimaryBy1":
        range=new Seq2d();
        while ( rc=range.go() ) {
          if ( v.pb.get(rc[0],rc[1])=="s" ) {
            ship=[ rc ]; // one square
            this._ships.push(ship);
          }
        }
        break;
      case "byWarrant":
        sy=new ShipYard(plan);
        this.take(sy.buildAll());
        if (!this.checkMargins()) throw ("Fleet::build: margins check failed");
        //this.show(v.tb); // DEBUG
        break;
    }// end switch
  };// end build()

  /**
   * Checks a given point against the ships list.
   * @param {array|interger} row [row,col] or just row
   * @param integer col
   * @return {boolean|array} false on miss, striken ship on hit
   */
  this.checkHit=function(row,col) {
    if ( row instanceof Array ) {
      col=row[1];
      row=row[0];
    }
    var ship=[],i;
    for ( i=0; i<this._ships.length; i++ ) {
      ship=this._ships[i];
      if ( ship.indexOfVect([row,col]) >= 0 ) {
        return (ship);
      }
    }
    return false;
  };

  /**
   * Shows all ships on a given board
   * @param {object Board} board
   * @return nothing
   */
  this.show=function(board) {
    if (! board instanceof Board) throw new Error ("Fleet::show: invalid argument type");
    var ship,point;
    var i,j;
    for ( i=0; i<this._ships.length; i++ ) {
      ship=this._ships[i];;
      for ( j=0; j<ship.length; j++ ) {
        point=ship[j];
        board.put("s",point);
      }
    }
  };

  /**
   * Indexes the ships into array size=>quantity.
   * @return array
   * @example
   * [0,4,3,2,1,0,0,0,0,0,0]
   * @see StatPanel.prototype.showClearHistogram()
   */
  this.makeHistogram=function() {
    var histogram=createArray(DIM+1,0);
    var k,decks=0;
    for ( k=0; k<this._ships.length; k++ ) {
      decks=this._ships[k].length;
      histogram[decks]++;
    }
    return (histogram);
  };

  /**
   * Counts the total number of squares, occupied by ships. Useful for tests.
   * @return integer
   */
  this.countArea=function() {
    var k,area=0;
    for ( k=0; k<this._ships.length; k++ ) {
      area+=this._ships[k].length;
    }
    return(area);
  };

  /**
   * Checks ships for collisions and contacts.
   * Similar to Fleet::trySail
   * @return boolean true on Ok, false on failure
   */
  this.checkMargins=function() {
    var rc;
    var ship0,ship,around0;
    var i,j,k;
    var l=this._ships.length;
    for(i=0;i<l;i++) {
      ship0=this._ships[i];
      around0=around(ship0);
      for(j=0;j<l;j++) {
        if (j==i) continue; // don't check a ship against itself
        ship=this._ships[j];
        for (k=0;k<ship.length;k++) {
          rc=ship[k];
          if ( (ship0.indexOfVect(rc)>=0) || (around0.indexOfVect(rc)>=0) ) {
            //alert ("collision at "+rc);
            return(false);
          }
        }
      }
    }
    return (true);
  };

  this.clear=function() {
    this._ships=[];
  }

  this.take=function(ships) {
    this._ships=ships;
  };
}// end Fleet

/**
 * Ships and game statistics.
 * @constructor
 * All properties are public.
 */
function Stat() {
  this.strikes=0;
  this.hits=0;
  this.shipsAlive=0;
  this.biggestShip=0;
  this.shipsSunk=0;
  this.hst=[];

  this.addStrike=function() { this.strikes++ };
  this.addHit=function() { this.hits++ };

  /**
   * Initialize.
   * @param array hist A histogram
   * @see Fleet::makeHistogram
   */
  this.setShips=function(hist){
    this.hst=hist.slice();// copy
    var i;
    if (hist.length!=DIM+1 || hist[0]) throw new Error("Stat::setShips: Invalid argument:"+hist);
    this.shipsSunk=0;
    this.shipsAlive=0;
    for( i=DIM+1; i--; i>0 ) {
      if(this.biggestShip==0 && hist[i]>0) this.biggestShip=i;
      this.shipsAlive+=hist[i];
    }
  };

  /**
   * Count a sunk ship.
   * @param array ship Only size is actually used
   */
  this.minusOne=function(ship) {
    var decks=ship.length;
    var i;
    if(this.hst[decks]==0) throw new Error("Stat::minusOne: There should be no more ships of "+decks+" squares");
    this.hst[decks]--;

    this.shipsSunk++;
    this.shipsAlive--;
    if (this.shipsAlive==0) return(true);// no more ships, time to finish

    for ( i=DIM+1; i--; i>0 ) {
      if( this.hst[i]>0 ) {
        //alert("biggest recalculated");
        this.biggestShip=i;
        break;
      }
    }
    return;
  };
}// end Stat

/**
 * A class that is used to manage strikes in a mode "as many strikes as is the size of the biggest ship"
 * @constructor
 * @param {object Stat} stat
 */
function Clip(stat) {
  var _rounds=0;// private

  this.load=function(cheatVal) {
    if (cheatVal) _rounds=cheatVal;
    else _rounds=stat.biggestShip;
    return (_rounds);
  };

  this.dec=function() { _rounds--; };

  this.get=function() { return(_rounds); };
}