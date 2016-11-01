"use strict";

function Game() {
  this._stage="init";// init ships fight finish
  this._active="p";// p e
  this._forces=[0,4,3,2,1,0,0,0,0,0];//[0,0,1,1,1,1,0,0,0,0];
  this._winner=0;

}

var rand=new Rand2d();

function go(command,data1,data2) {
  var row,col,point,hit,ship;
  var congrats;
  switch (g._stage) {
    case "init":
      //alert("init");
      //var privBas=new Basin("private");
      //v.pb.fromBasin(privBas);
      
      v.showConfirmShips();
      g._stage="ships";
      return;
    case "ships":
      if( command=="set" && (data1+data2).length==2 ) {
        row=data1;
        col=data2;
        if ( v.pb.get(row,col) != "s" ) v.pb.put(row,col,"s");
        else v.pb.put(row,col,"e");
      }
      if( command=="cs") {
        v.pb.toBasin(m.playerBasin);
        //v.pb.toBasin(m.reserveBasin);
        
        var h=new Harvester(m.playerBasin);
        h.search();
        alert (h._ships.length+" ships found");
        
        
        var histogram=createArray(DIM,0); //[0,0,0,0,0,0,0,0,0,0];
        var len=0;
        for (var k=0;k<h._ships.length;k++) {
          len=h._ships[k].length;
          histogram[len]++;
        }
        var hst="";
        for (var l=0;l<DIM;l++) {
          hst+=""+l+":"+histogram[l]+"  ";
        }
        //alert(hst);
        //v.pb.fromBasin(m.reserveBasin);
        
        //m.playerBasin._arr=m.reserveBasin._arr;
        m.playerBasin.cleanUp();
        v.pb.fromBasin(m.playerBasin);
        if( histogram.join()!=g._forces.join() ) {
          alert ("Your ships does not comply with rules:"+g._forces.join());
          //return;
        }
        
        
        m.playerShips = new Fleet();
        m.playerShips.ships=h._ships;
        
        
        var ph=m.playerShips.makeHistogram();
        pStat.setShips(ph);
        v.ps.showStat(pStat._shipsAlive,pStat._biggestShip,pStat._shipsSunk);
        v.ps.showClearHistogram(ph);
        v.hideConfirmShips();
        g._stage="fight";
      } 
      return;
    case "fight":
      if( g._active=="p" && command=="strike" && (data1+data2).length==2 ) {
        row=data1;
        col=data2;
        pStat.addStrike();
        if ( hit=m.enemyShips.checkHit(row,col) ) {
          pStat.addHit();
          m.enemyBasin.put("h",row,col);
          v.tb.fromBasin(m.enemyBasin);
          //v.tb.put(row,col,"h");
          if ( m.enemyBasin.checkSunk(hit) ) {
            // An enemy ship KILLED!
            if (eStat.minusOne(hit)) g._stage="finish";
            v.es.showStat(eStat._shipsAlive,eStat._biggestShip,eStat._shipsSunk);
            //v.es.showClearHistogram(eStat._hst);// DEBUG
            m.enemyBasin.markSunk(hit);
            m.enemyBasin.markAround(hit);
            v.tb.fromBasin(m.enemyBasin);
          }
        }
        else {
          m.enemyBasin.put("m",row,col);
          v.tb.put(row,col,"m");          
          g._active="e";
        }
        v.ps.showStrikesHits(pStat._strikes,pStat._hits);
        // fall-through
      }
      while ( g._active=="e" && g._stage!="finish" ) {
        while ( m.enemyMoves.indexOfVect( point=rand.go() ) > 0 ) {};
        m.enemyMoves.push(point);
        row=point[0];
        col=point[1];
        eStat.addStrike();      
        if ( hit=m.playerShips.checkHit(row,col) ) {
          eStat.addHit();
          m.playerBasin.put("h",row,col);
          v.pb.put(row,col,"h");
          if ( m.playerBasin.checkSunk(hit) ) {
            // A player;s ship KILLED!
            if(pStat.minusOne(hit)) g._stage="finish";
            v.ps.showStat(pStat._shipsAlive,pStat._biggestShip,pStat._shipsSunk);           
            m.playerBasin.markSunk(hit);
            //m.playerBasin.markAround(hit);
            v.pb.fromBasin(m.playerBasin);
          }
        }
        else {
          m.playerBasin.put("m",row,col);
          v.pb.put(row,col,"m");
          g._active="p";
        }
        v.es.showStrikesHits(eStat._strikes,eStat._hits);       
      }// end while
      if (g._stage!="finish") return;
      // fallthrough
    case "finish":
      if(g._active=="p") {
          g._winner="p";
          congrats="YOU WIN !";
      }
      else {
          g._winner="p";
          congrats="GAME OVER, You lose";
      }
      alert(congrats);
      return;
    default: return;
  }// end switch


}

//const DIM=10;
var g=new Game();
var v=new View();
var m=new Model();
var pStat=new Stat();
var eStat=new Stat();

m.enemyShips=new Fleet();
m.enemyShips.build("byWarrant");
var eh=m.enemyShips.makeHistogram();
v.es.showClearHistogram(eh);
eStat.setShips(eh);
v.es.showStat(eStat._shipsAlive,eStat._biggestShip,eStat._shipsSunk);

//alert("instantiated");
go();

//var es=new Fleet("byForces");
//alert("new ships:"+es.ships.length);
 