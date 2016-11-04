"use strict";

function Game() {
  this._stage="init";// init ships fight finish
  this._active="p";// p e
  this._forces=[0,4,3,2,1,0,0,0,0,0,0];//[0,0,1,1,1,1,0,0,0,0,0];
  this._demandEqualForces=0;
  this._previewEnemyShips=1;//0;//1;
  this._enemyStriker="harvester";// "random";
  //this._strikeRule="oe";// one plus extra one for each hit
  this._strikeRule="bs";// size of the biggest alive ship
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
      m.enemyStat.setShips(eh);
      v.es.showStat(m.enemyStat._shipsAlive,m.enemyStat._biggestShip,m.enemyStat._shipsSunk);
      if (g._previewEnemyShips) {
        m.enemyShips.show(v.tb);
        //m.enemyBasin.takeShips(m.enemyShips._ships);
        //v.tb.fromBasin(m.enemyBasin);
      }
 
      v.dc.toggle();// show Draw controls
      v.pm.put("Draw your ships, then press Done");
      g._stage="ships";
      return;
      
    case "ships":
      
      v.pm.put("");
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
          v.pm.put("Ships must be straight and not touch each other. <br />Try new ones");
          m.playerShips.clear();
          return;
        }
        var ph=m.playerShips.makeHistogram();
        if( ph.join()!=g._forces.join() ) {
          mes="The rules require (squares:ships): ";
          mes+=v.ps.showClearHistogram(g._forces,"return");
          mes+='<br />Your ships does not comply';
          if ( g._demandEqualForces ) mes+="<br />Try new ones";
          v.pm.put( mes );
          
          //alert ("Your ships does not comply with rules:"+g._forces.join());
          if ( g._demandEqualForces ) {
            m.playerShips.clear();
            return;
          }
        }        

        m.playerStat.setShips(ph);
        v.ps.showStat(m.playerStat._shipsAlive,m.playerStat._biggestShip,m.playerStat._shipsSunk);
        v.ps.showClearHistogram(ph);
        
        v.dc.toggle();// hide controls
        v.pm.add("<br />Make your move!");
        g._stage="fight";
        
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
      
      if ( g._active=="p" && command=="enemyStrike" ) alert ("Wrong timed command "+command+"(hit="+hit+")");
      if ( g._active=="e" && command=="strike" ) alert ("Wrong timed command "+command+"(hit="+hit+")");
      
      v.pm.put("");
      v.em.put("");
      if( g._active=="p" && command=="strike" && data.length==2 ) {
        hit=e.respond(data);
        p.reflect(hit);
        v.ps.showStrikesHits(m.playerStat._strikes,m.playerStat._hits);
        displayResponce( hit, data, v.tb, m.enemyBasin, v.es, m.enemyStat, v.pm );// e.display
        if ( a.checkout(hit) ) return;
        // fall-through
      }
      
      if ( g._active=="e" && command=="enemyStrike" && data.length==2 ) {
        hit=p.respond(data);
        e.reflect(hit);
        v.es.showStrikesHits(m.enemyStat._strikes,m.enemyStat._hits);
        displayResponce( hit, data, v.pb, m.playerBasin, v.ps, m.playerStat, v.em );//p.display
        if (hit=="n") 
          alert( "Enemy repeats itself on "+data+" that is "+v.playerBasin.get(data[0],data[1]) );// this is not to happen
        if ( a.checkout(hit) ) return;
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
        v.pm.put("YOU HAVE WON !");  
      }
      else {
        g._winner="p";
        v.em.put("ENEMY HAS WON !");    
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
function strikeResponce(probe,fleet,ownBasin,stat) {
  var row=probe[0];
  var col=probe[1];
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

function displayResponce ( responce, probe, targetBoard, targetBasin, targetStatPanel, targetStat, mesPanel ) {
  if ( responce=="n" ) {
    mesPanel.add("Strike on already marked square "+probe[0]+probe[1]);
    return;
  }
  if ( responce=="h" || responce=="m" ) {
    targetBoard.put(probe[0],probe[1],responce);
    return;
  } 
  if ( responce=="w" || responce=="f" ) {
    targetBoard.fromBasin(targetBasin);   
    targetStatPanel.showStat(targetStat._shipsAlive,targetStat._biggestShip,targetStat._shipsSunk);
    return;
  }   
}

function Active (player,enemy,game) {
  //this._letter="p";
  this._self=player;
  this._game=game;
  this._letter=this._game._active;
    
  this.setPlayer=function() {
    this._letter="p";
    this._self=player;
  }

  this.setEnemy=function() {
    this._letter="e";
    this._self=enemy;
  }
    
  this.swap=function() {
    if (this._letter=="p") this.setEnemy();
    else if (this._letter=="e") this.setPlayer();
    else throw ("Active::swap: wrong letter");
    this._game._active=this._letter;      
  }
  
  /* Checks hit and other parameters, changes game state (active side, stage), calls strike() for a new move
   * Supports two game modes (defined by Game._strikeRule)
   * 
   * @param char hit value from last respond()
   * @return boolean false if game is finished, true if not finished 
   */ 
  this.checkout=function(hit) {
    if ( hit=="f" ) {
      this._game._stage="finish";
      return false;
    }
    if (this._game._strikeRule=="bs") { // as many strikes as the size of biggest alive ship
      var rem=this._self._clip.get();
      if (rem) {
        //alert (rem+" strikes remain");
        this._self._mesPanel.add ( rem+" strikes remain" );
        this._self.strike();
        return true;
      }
      else {
        //alert ("It was a "+this._letter+"'s move");
        this.swap();
        //alert ("Now it's a "+this._letter+"'s move");
        rem=this._self._clip.load();
        this._self._mesPanel.add ( "Firepower is "+rem+" strikes" );
        this._self.strike();
        return true;        
      }
    }
    if (this._game._strikeRule=="oe") { // one plus extra one for each hit
      if( hit=="m" ) {
        //alert ("It was a "+this._letter+"'s move");
        this.swap();
        //alert ("Now it's a "+this._letter+"'s move");
        this._self.strike();
        return true;
      }
      if ( hit=="h" || hit=="w" ) {
        //alert (this._letter+" has an extra move");
        if (this._letter=="p") var mes="You've hit the enemy. Make an ";
        else var mes="Enemy has an ";
        this._self._mesPanel.add ( mes+"extra move" );
        this._self.strike();
        return true;
      }             
    }
  }
}

function Enemy (fleet,ownBasin,stat,clip,targetBasin,mesPanel,mode) {
  var _this=this;
  this._fleet=fleet;
  this._ownBasin=ownBasin;
  this._targetBasin=targetBasin;
  this._stat=stat;
  this._clip=clip;  
  this._mesPanel=mesPanel;
  this._mode=mode;
  
  if (mode=="harvester") this._striker=new Harvester(targetBasin);
  else { // construct a random striker
    this._rand=new Rand2d();
    this._striker={};
    _this._striker.move=function(){ return( randomStrike(_this._targetBasin,_this._rand) ); };
    _this._striker.reflect=function(responce){};
  }
  
  this.strike=function() {
    //var probe=randomStrike(this._targetBasin,this._rand);
    var probe=_this._striker.move();
    v.pb.put(probe[0],probe[1],"f");
    var t=window.setTimeout( function(){ 
      //alert("Enemy is striking");
      go("enemyStrike",probe);
    }, 200 );
  }
  
  this.respond=function (probe) {
    return ( strikeResponce ( probe, this._fleet, this._ownBasin, this._stat ) );
  }
  
  this.reflect=function (responce) {
    this._striker.reflect(responce);
    strikeCount ( responce, this._stat );
    this._clip.dec();
  }
  
  this.hi=function() { return ("Hi, I'm Enemy") }

}

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
  }
  
  this.reflect=function (responce) {
    strikeCount( responce, this._stat );
    this._clip.dec();
  }
}
 