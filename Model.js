'use strict';

function Model() {
  this.playerBasin=new Basin;
  this.enemyBasin=new Basin("public");
  //this.reserveBasin=new Basin;

  this.checkShips=function() {
    return true;
  }
  
  this.enemyMoves=[];

  this.playerShips=[];
  this.enemyShips=[];
}


function ShipYard(hist) {
  this.ships=[];
  this.rand=new Rand2d(); 
  this._plan=hist;

  this.tryBuildShip=function(rc,decks,rowOrCol) {
    var ship=[];
    var row=rc[0];
    var col=rc[1];
    var rcc;
    if (!rowOrCol && ( row+decks>=DIM ) ) return(false);
    if (rowOrCol && ( col+decks>=DIM ) ) return(false);
    for( var l=0;l<decks;l++ ){      
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
  }
  
  this.trySailBasin=function(ship) {
    var rc;
    var around=this._b.collectAround(ship);
    //alert("Around are "+around.length+" squares");
    for (var i=0;i<around.length;i++) {
      rc=around[i];
      if( this._b.get(rc[0],rc[1])==="s" ) return false;
    }
    return true;
  }
  
  this.trySail=function(newShip) {
    var rc;
    var ship;
    var aroundNew=around(newShip);
    for(var i=0;i<this.ships.length;i++) {
      ship=this.ships[i];
      for(var j=0;j<ship.length;j++) {
        rc=ship[j];
        if ( (newShip.indexOfVect(rc)>=0) || (aroundNew.indexOfVect(rc)>=0) ) return(false);
      }
    }
    return (true);
  }    
  
  this.buildAndSail=function(decks) {
    var rc=this.rand.go();
    var rc2=this.rand.go();
    var ship;
    while ( false===( ship=this.tryBuildShip(rc,decks,(rc2[0]>rc2[1]) ) ) || false===this.trySail(ship) ) {
      rc=this.rand.go();
      rc2=this.rand.go();      
    }
    //alert ("Meet a new ship of "+decks+" squares");
    //m.enemyBasin.markShip(ship);
    //m.enemyBasin.markAround(ship);
    this.ships.push(ship);
  }
  
  this.buildAll=function() {
    var decks=DIM+1;
    while ( !hist[--decks] ) {};// skip zeroes
    while ( hist[decks]>0 && decks>0 ) {
      for (var i=0;i<hist[decks];i++ ) {
        this.buildAndSail(decks);
      }
      decks--;
      //decks=0;
    }
    return(this.ships);
  }
}


function Fleet() {
  this.ships=[];
  
  this.build=function (mode) {
    var ship=[];
    var point,rc;
    var range=new Seq2d();
    var rand=new Rand2d();
    
    switch (mode) {
      case "random20by1":
        var allPoints=[];
        for (var i=0;i<20;i++) {
          while ( this.allPoints.indexOfVect( rc=rand.go() ) >= 0 ) {};
          this.allPoints.push(rc);
          //alert(">"+point);
          ship=[ rc ];
          this.ships.push(ship);
        }
        break;
      case "fromPrimaryBy1":
        while ( rc=range.go() ) {
          //alert(">>"+rc[0]+rc[1]);
          if ( v.pb.check(rc[0],rc[1],"s") ) {
            ship=[ rc ];
            this.ships.push(ship);
          }
        }
        //alert(this.ships.length+"<");
        break;
      case "byForces": 
        var sy=new ShipYard(g._forces);
        //this.ships=sy.buildAll();
        this.take(sy.buildAll());
        for (var i=0;i<this.ships.length;i++) { // DEBUG
          //m.enemyBasin.markShip(this.ships[i]);
        }
        //this.ships.every( m.enemyBasin.markShip );
        this.show(v.tb); // DEBUG
        break;
    }// end switch
  }
  
  this.checkHit=function(row,col) {
    var ship;
    for (var i=0;i<this.ships.length;i++) {
      ship=this.ships[i];
      //alert(i+"th ship:count "+ship.length+" coord0:"+ship[0][0]+ship[0][1]);
      if ( ship.indexOfVect([row,col]) >= 0 ) {
        //alert("Hit at "+row+col);
        return (ship);
      }
    }
    //alert("Miss at "+row+col);
    return false;
  }
  
  this.show=function(board) {
    var ship,row,col,point;
    for (var i=0;i<this.ships.length;i++) {
      ship=this.ships[i];
      //alert(i+"th ship:count "+ship.length);
      for (var j=0;j<ship.length;j++) {
        point=ship[j];
        //alert("="+point);
        row=point[0];
        col=point[1];
        board.put(row,col,"s");
      }
    }
    return false;
  }
  
  this.makeHistogram=function() {
    var histogram=createArray(DIM,0);
    var decks=0;
    for (var k=0;k<this.ships.length;k++) {
      decks=this.ships[k].length;
      histogram[decks]++;
    }
    return (histogram);
  }
  
  this.checkMargins=function() {
    var rc;
    var ship0,ship,around0;
    var i,j,k;
    var l=this.ships.length;
    for(i=0;i<l;i++) {
      ship0=this.ships[i];
      around0=around(ship0);
      for(j=0;j<l;j++) {
        if (j==i) continue; // don't check a ship against itself
        ship=this.ships[j];
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
  }
  
  this.clear=function() {
    this.ships=[];
  }
  
  this.take=function(ships) {
    this.ships=ships;
  }
}// end Ships

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
    this._hst=hist.slice();
    if (hist.length!=DIM || hist[0]) alert("Usage error! Invalid argument hist for initShips");
    for(var i=DIM;i--;i>0) {
      if(this._biggestShip==0 && hist[i]>0) this._biggestShip=i;
      this._shipsAlive+=hist[i];
    }
  }
  
  this.minusOne=function(ship) {
    var decks=ship.length;
    if(this._hst[decks]==0) alert("Error! There should be no more ships of "+decks+" squares");
    this._hst[decks]--;
    
    this._shipsSunk++;
    this._shipsAlive--;
    if(this._shipsAlive==0) return(true);

    for (var i=DIM;i--;i>0) {
      if( this._hst[i]>0 ) {
        //alert("biggest recalculated");
        this._biggestShip=i;
        break;
      }
    }
    return;
  }
  
}
