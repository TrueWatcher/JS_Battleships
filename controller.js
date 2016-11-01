"use strict";

function Game() {
  this._stage="init";// init ships fight finish
  this._active="p";// p e
  this._forces=[0,4,3,2,1,0,0,0,0,0];//[0,0,1,1,1,1,0,0,0,0];
  this._demandEqualForces=0;
  this._winner=0;

}

var rand=new Rand2d();

function go(command,data) {
  var row,col,point,hit,ship;
  var c,mes;
  var congrats;
  
  switch (g._stage) {
    
    case "init":
      //alert("init");
      m.enemyShips=new Fleet();
      m.enemyShips.build("byWarrant");
      var eh=m.enemyShips.makeHistogram();
      v.es.showClearHistogram(eh);
      eStat.setShips(eh);
      v.es.showStat(eStat._shipsAlive,eStat._biggestShip,eStat._shipsSunk);
      m.enemyShips.show(v.tb); // CHEAT !     

      v.dc.toggle();// show Draw controls
      v.playerMessagePut("Draw your ships, then press Done");
      g._stage="ships";
      return;
      
    case "ships":
      
      v.playerMessagePut("");
      if( command=="set" && data.length==2 ) {
        row=data[0];
        col=data[1];
        if ( m.playerBasin.get(row,col) != "s" ) c="s";
        else c="e";
        m.playerBasin.put(c,row,col);  
        v.pb.put(row,col,c);
      }
      
      if( command=="rs") {
        m.playerBasin.clear();
        v.pb.fromBasin(m.playerBasin);
      }
      
      if( command=="as") {
        var sy=new ShipYard(g._forces);
        var ps=sy.buildAll();
        m.playerBasin.clear();
        m.playerBasin.takeShips(ps);
        v.pb.fromBasin(m.playerBasin);
      }
      
      if( command=="cs") {
        //v.pb.toBasin(m.playerBasin);
        //v.pb.toBasin(m.reserveBasin);
        
        var h=new Harvester(m.playerBasin);
        h.search();
        //v.pb.fromBasin(m.playerBasin);// DEBUG
        m.playerBasin.cleanUp();
        v.pb.fromBasin(m.playerBasin);
        alert (h._ships.length+" ships found");
        m.playerShips = new Fleet();
        m.playerShips.clear();
        var hs=h.yield();
        m.playerShips.take(hs);
        var cm=m.playerShips.checkMargins();
        if (!cm) {
          //alert("Ships must be straight and not touch each other. Try new ones");
          v.playerMessagePut("Ships must be straight and not touch each other. <br />Try new ones");
          m.playerShips.clear();
          return;
        }
        var ph=m.playerShips.makeHistogram();
        if( ph.join()!=g._forces.join() ) {
          mes="Rules are (squares:ships): ";
          mes+=v.ps.showClearHistogram(g._forces,"return");
          mes+='<br />Your ships does not comply';
          
          if ( g._demandEqualForces ) mes+="<br />Try new ones";
          v.playerMessagePut( mes );
          
          //alert ("Your ships does not comply with rules:"+g._forces.join());
          if ( g._demandEqualForces ) {
            m.playerShips.clear();
            return;
          }
        }        

        pStat.setShips(ph);
        v.ps.showStat(pStat._shipsAlive,pStat._biggestShip,pStat._shipsSunk);
        v.ps.showClearHistogram(ph);
        
        v.dc.toggle();// hide controls
        v.playerMessageAdd("<br />Make your move!");
        g._stage="fight";
      } 
      return;
      
    case "fight":
      
      v.playerMessagePut("");
      v.enemyMessagePut("");
      if( g._active=="p" && command=="strike" && data.length==2 ) {
        row=data[0];
        col=data[1];
        pStat.addStrike();
        if ( hit=m.enemyShips.checkHit(row,col) ) {
          // hit
          v.playerMessageAdd("You've hit the enemy, make an extra move");
          pStat.addHit();
          m.enemyBasin.put("h",row,col);
          v.tb.fromBasin(m.enemyBasin);
          //v.tb.put(row,col,"h");
          if ( m.enemyBasin.checkSunk(hit) ) {
            // An enemy ship was KILLED!
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
        v.enemyMessagePut("Enemy is striking"); 
        if ( hit=m.playerShips.checkHit(row,col) ) {
          eStat.addHit();
          m.playerBasin.put("h",row,col);
          v.pb.put(row,col,"h");
          if ( m.playerBasin.checkSunk(hit) ) {
            // A player's ship was KILLED!
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
          v.enemyMessagePut(""); 
          g._active="p";
        }
        v.es.showStrikesHits(eStat._strikes,eStat._hits);       
      }// end while
      if (g._stage!="finish") return;
      // fall-through
      
    case "finish":
      
      if(g._active=="p") {
        g._winner="p";
        //congrats="YOU WIN !";
        v.playerMessagePut("YOU HAVE WON !");  
      }
      else {
        g._winner="p";
        //congrats="GAME OVER, You lose";
        v.enemyMessagePut("ENEMY HAS WON !");    
      }
      //alert(congrats);
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

//alert("instantiated");
go();

 