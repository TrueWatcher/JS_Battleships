'use strict';

function Model() {
  this.playerBasin=new Basin();
  this.enemyBasin=new Basin("public");

  //this.enemyMoves=[];

  this.playerShips={};
  this.enemyShips={};

  this.playerStat=new Stat();
  this.enemyStat=new Stat();

  this.playerClip=new Clip(this.playerStat);
  this.enemyClip=new Clip(this.enemyStat);
}


function ShipYard(hist) {
  var _ships=[];
  var _rand=new Rand2d();
  //this._plan=hist;

  this.tryBuildShip=function(rc,decks,rowOrCol) {
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

  this.trySail=function(newShip,skipCheckMargin) {
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

  this.buildAndSail=function(decks) {
    var rc=_rand.go();
    var rc2=_rand.go();
    var ship=[];
    while ( false === ( ship=this.tryBuildShip(rc,decks,(rc2[0]>rc2[1]) ) ) || false === this.trySail(ship) ) {
      rc=_rand.go();
      rc2=_rand.go();
    }
    _ships.push(ship);
  };

  this.buildAll=function() {
    var i,decks=DIM+1;
    while ( !hist[--decks] ) {};// skip zeroes
    while ( hist[decks]>0 && decks>0 ) {
      for ( i=0; i<hist[decks]; i++ ) {
        this.buildAndSail(decks);
      }
      decks--;
    }
    return(_ships);
  };
}// end ShipYard


function Fleet() {
  this._ships=[];

  this.build=function (mode) {
    var ship=[];
    var rc;
    var range=new Seq2d();
    var rand=new Rand2d();
    var i,allPoints=[],sy;

    switch (mode) {
      case "random20by1":
        for (i=0;i<20;i++) {
          while ( this.allPoints.indexOfVect( rc=rand.go() ) >= 0 ) {};
          this.allPoints.push(rc);
          ship=[ rc ]; // one square
          this._ships.push(ship);
        }
        break;
      case "fromPrimaryBy1":
        while ( rc=range.go() ) {
          if ( v.pb.get(rc[0],rc[1])=="s" ) {
            ship=[ rc ]; // one square
            this._ships.push(ship);
          }
        }
        break;
      case "byWarrant":
        sy=new ShipYard(g.getForces());
        this.take(sy.buildAll());
        if (!this.checkMargins()) throw ("Fleet::build: margins check failed");
        //this.show(v.tb); // DEBUG
        break;
    }// end switch
  };// end build()

  this.checkHit=function(row,col) {
    var ship=[],i;
    for ( i=0; i<this._ships.length; i++ ) {
      ship=this._ships[i];
      //alert(i+"th ship:count "+ship.length+" coord0:"+ship[0][0]+ship[0][1]);
      if ( ship.indexOfVect([row,col]) >= 0 ) {
        //alert("Hit at "+row+col);
        return (ship);
      }
    }
    //alert("Miss at "+row+col);
    return false;
  };

  this.show=function(board) {
    var ship,row,col,point;
    var i,j;
    for ( i=0; i<this._ships.length; i++ ) {
      ship=this._ships[i];;
      for ( j=0; j<ship.length; j++ ) {
        point=ship[j];
        row=point[0];
        col=point[1];
        board.put("s",row,col);
      }
    }
  };

  this.makeHistogram=function() {
    var histogram=createArray(DIM+1,0);
    var k,decks=0;
    for ( k=0; k<this._ships.length; k++ ) {
      decks=this._ships[k].length;
      histogram[decks]++;
    }
    return (histogram);
  };

  this.countArea=function() {
    var k,area=0;
    for ( k=0; k<this._ships.length; k++ ) {
      area+=this._ships[k].length;
    }
    return(area);
  };

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

function Stat() {
  this._strikes=0;
  this._hits=0;
  this._shipsAlive=0;
  this._biggestShip=0;
  this._shipsSunk=0;
  this._hst=[];

  this.addStrike=function() { this._strikes++ }
  this.addHit=function() { this._hits++ }

  this.setShips=function(hist){
    this._hst=hist.slice();// copy
    var i;
    if (hist.length!=DIM+1 || hist[0]) throw ("Stat::setShips: Invalid argument:"+hist);
    this._shipsSunk=0;
    this._shipsAlive=0;
    for( i=DIM+1; i--; i>0 ) {
      if(this._biggestShip==0 && hist[i]>0) this._biggestShip=i;
      this._shipsAlive+=hist[i];
    }
  };

  this.minusOne=function(ship) {
    var decks=ship.length;
    var i;
    if(this._hst[decks]==0) throw ("Stat::minusOne: There should be no more ships of "+decks+" squares");
    this._hst[decks]--;

    this._shipsSunk++;
    this._shipsAlive--;
    if (this._shipsAlive==0) return(true);// no more ships, time to finish

    for ( i=DIM+1; i--; i>0 ) {
      if( this._hst[i]>0 ) {
        //alert("biggest recalculated");
        this._biggestShip=i;
        break;
      }
    }
    return;
  };
}// end Stat

function Clip(stat) {
  var _rounds=0;

  this.load=function(cheatVal) {
    if (cheatVal) _rounds=cheatVal;
    else _rounds=stat._biggestShip;
    return (_rounds);
  };

  this.dec=function() { _rounds--; };

  this.get=function() { return(_rounds); };
}