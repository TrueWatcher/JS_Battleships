"use strict";

function Game() {
  this._stage="init";// init ships fight finish
  this._active="p";// p e
  this._forces=[0,4,3,2,1,0,0,0,0,0];//[0,0,1,1,1,1,0,0,0,0];
  this._demandEqualForces=0;
  this._winner=0;

}

var hit;// after DEBUG can be moved inside the go()

function go(command,data) {
  var row,col,point,ship;
  var c,mes;
  
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
      if( command=="set" && data.length==2 ) { // set a square to ship or empty
        row=data[0];
        col=data[1];
        if ( m.playerBasin.get(row,col) != "s" ) c="s";
        else c="e";
        m.playerBasin.put(c,row,col);  
        v.pb.put(row,col,c);
      }
      
      if( command=="rs") { // remove all ships
        m.playerBasin.clear();
        v.pb.fromBasin(m.playerBasin);
      }
      
      if( command=="as") { // automatically draw ships
        var sy=new ShipYard(g._forces);
        var ps=sy.buildAll();
        m.playerBasin.clear();
        m.playerBasin.takeShips(ps);
        v.pb.fromBasin(m.playerBasin);
      }
      
      if( command=="cs") { // check up and go playing        
        var h=new Harvester(m.playerBasin);
        h.search();
        //v.pb.fromBasin(m.playerBasin);// DEBUG
        m.playerBasin.cleanUp();
        v.pb.fromBasin(m.playerBasin);
        //alert (h._ships.length+" ships found");
        var hs=h.yield();
        m.playerShips = new Fleet();        
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
          mes="The rules require (squares:ships): ";
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
        
        e=new Enemy( m.enemyShips,m.enemyBasin,eStat,m.playerBasin );
        //alert("E_hi="+e.hi());
        p=new PlayerAssistant( m.playerShips,m.playerBasin,pStat );
      } 
      return;
      
    case "fight":
      
      if ( g._active=="p" && command=="enemyStrike" ) alert ("Wrong timed command "+command+"(hit="+hit+")");
      if ( g._active=="e" && command=="strike" ) alert ("Wrong timed command "+command+"(hit="+hit+")");
      
      v.playerMessagePut("");
      v.enemyMessagePut("");
      if( g._active=="p" && command=="strike" && data.length==2 ) {
        row=data[0];
        col=data[1];
        hit=e.respond(row,col);
        p.reflect(hit);
        // visualisation and next move
        v.ps.showStrikesHits(pStat._strikes,pStat._hits);
        if ( hit=="n" ) { 
          v.playerMessageAdd("You are striking on marked square "+row+col);
          return;
        }
        if( hit=="m" ) {
          v.tb.put(row,col,"m");
          g._active="e";
          e.strike();          
          return;    
        }
        v.tb.put(row,col,"h");
        if ( hit=="h" || hit=="w" ) v.playerMessageAdd("You've hit the enemy, make an extra move");
        if ( hit=="f" ) g._stage="finish";
        // fall-through
        if ( hit=="w" || hit=="f" ) {
          v.tb.fromBasin(m.enemyBasin);
          v.es.showStat(eStat._shipsAlive,eStat._biggestShip,eStat._shipsSunk);          
        }
        // fall-through
        if ( g._stage!="finish" ) return;
        // fall-through
      }
      
      if ( g._active=="e" && command=="enemyStrike" && data.length==2 ) {
        row=data[0];
        col=data[1];
        hit=p.respond(row,col);
        e.reflect(hit);
        // visualisation and next move
        v.es.showStrikesHits(eStat._strikes,eStat._hits);
        if ( hit=="n" ) { 
          alert("Enemy repeats itself on "+row+col+" that is "+v.playerBasin.get(row,col));
          g._active="p";
          return;
        }
        if( hit=="m" ) {
          v.pb.put(row,col,"m");
          g._active="p";
          //e.strike();          
          return;    
        }
        v.pb.put(row,col,"h");
        if ( hit=="h" || hit=="w" ) v.enemyMessagePut("Enemy has an extra move");
        if ( hit=="f" ) g._stage="finish";
        // fall-through
        if ( hit=="w" || hit=="f") {
          v.pb.fromBasin(m.playerBasin);
          v.ps.showStat(pStat._shipsAlive,pStat._biggestShip,pStat._shipsSunk);          
        }
        // fall-through
        if ( hit=="h" || hit=="w" ) {
          e.strike();
          return;
        }
        if ( g._stage!="finish" ) return;// over-safe ;)
        // fall-through
      }
      if ( g._stage!="finish" ) {
        alert(">>"+g._active+"&"+command+"&"+data+"&"+g._stage);
        return;
      }
      // fall-through
      
    case "finish":
      
      if(g._active=="p") {
        g._winner="p";
        v.playerMessagePut("YOU HAVE WON !");  
      }
      else {
        g._winner="p";
        v.enemyMessagePut("ENEMY HAS WON !");    
      }
      return;
      
    default: return;
  }// end switch
}

function randomStrike(targetBasin,randGen) {
  var probe=randGen.go();
  while ( ! targetBasin.checkStrikable(probe[0],probe[1]) ) { probe=randGen.go(); }
  return (probe);
}

/* Checks an opponent's move against own Fleet and Basin
 *  
 * @return string n-wrong move,m-miss,h-hit,w-killed,f-finished
 */ 
function strikeResponce(row,col,fleet,ownBasin,stat) {
  //alert( ">"+typeof(fleet)+" hit="+m.enemyShips.checkHit(row,col) );
  if ( !ownBasin.checkStrikable(row,col) ) return ("n");
  var hit=fleet.checkHit(row,col);// false or striken ship
  if ( hit===false ) { // miss
    ownBasin.put("m",row,col);
    return ("m");
  }
  ownBasin.put("h",row,col);
  if ( ownBasin.checkSunk(hit)===false ) { return ("h"); } // hit but not sunk
  ownBasin.markSunk(hit);
  ownBasin.markAround(hit);
  if ( stat.minusOne(hit) ) { return ("f"); }
  return  ("w");
}

function strikeCount(responce,stat) {
  stat.addStrike();
  if ( responce !="m" && responce!="n" ) stat.addHit();
}

function Enemy (fleet,ownBasin,stat,targetBasin) {
  this._fleet=fleet;
  this._ownBasin=ownBasin;
  this._targetBasin=targetBasin;
  this._stat=stat;
  this._rand=new Rand2d();
  
  this.strike=function() {
    var probe=randomStrike(this._targetBasin,this._rand);
    var t=window.setTimeout( function(){ alert("Enemy strikes");go("enemyStrike",probe); }, 100 );
  }
  
  this.respond=function (row,col) {
    return ( strikeResponce ( row, col, this._fleet, this._ownBasin, this._stat ) );
  }
  
  this.reflect=function (responce) {
    strikeCount ( responce, this._stat );
  }
  
  this.hi=function() { return ("Hi, I'm Enemy") }
}

function PlayerAssistant (fleet,ownBasin,stat) {
  this._fleet=fleet;
  this._ownBasin=ownBasin;
  this._stat=stat;
  //this.rand=new Rand2d();
  
  this.respond=function (row,col) {
    return ( strikeResponce ( row, col, this._fleet, this._ownBasin, this._stat ) );
  }
  
  this.reflect=function (responce) {
    strikeCount( responce, this._stat );
  }  
}

//const DIM=10;
var g=new Game();
var v=new View();
var m=new Model();
var pStat=new Stat();
var eStat=new Stat();

var e={},p={};

//alert("instantiated");
go();

 