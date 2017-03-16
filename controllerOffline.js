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
      details=v1.parsePickId(id);
      if ( details.side==g.pSide ) {
        v1.clearGroup(details.itemName, details.row, details.side);
        v1.tickHtml(id);
        myPicks=v1.readPicks(g.pSide);
        // copy picked items to enemy side
        v1.drawPicks("B",myPicks,v1.ticks["B"]);
      }
      //alert("myPicks:"+myPicks);
      // g.setState("converged");
      break;
    case "queryPick":
      alert("Command queryPick while playing locally");
      break;
    case "confirm":
      myPicks=v1.readPicks(g.pSide);
      //alert("myPicks:"+myPicks);
      if ( true !== compareKeys( JSON.parse(myPicks), g.defaultPicks ) ) { 
        alert ("Please, give all answers");
        break;
      }
      v1.putNote("rules","Done");
      g.pickStr=myPicks;
      g.setRules(myPicks);
      g.setStage("ships");
      //g.setState("draw");
      this.initPage2();
      break;
    default:
      throw new Error("RulesOnline::go: unknown command:"+command+"!");
    }
  };
  
  this.initPage2=function() {
    v1.putNote("rules","Loading page 2");
    //alert("Running page 2");
    //g=g;//new Game();
    
    if(typeof v !=="object") alert("onTransitToPage2: v is not the global object");
    if(typeof m !=="object") alert("onTransitToPage2: m is not the global object");
    v=new View(g);
    m=new Model();      
    
    v.setBoards(g._theme);
    v.putNames();
    
    if (g.allowHideControls) { 
      hideElement("intro");
      hideElement("rules");
      hideElement("finish");
    }
    displayElement("main");
    v.dc.display();

    m.enemyShips=new Fleet();
    m.enemyShips.build("byWarrant",g.getForces());
    var eh=m.enemyShips.makeHistogram();
    v.es.showClearHistogram(eh);
    m.enemyStat.setShips(eh);
    v.es.showStat(m.enemyStat.shipsAlive,m.enemyStat.biggestShip,m.enemyStat.shipsSunk);
    if (g._previewEnemyShips) {
      m.enemyShips.show(v.tb);
    }

    var mes="Draw your ships (";
    mes+=v.ps.showClearHistogram( g.getForces(),"return" );
    mes+="),<br />then press Done";
    v.pm.put(mes);
    g.setStage("ships");
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
    
    if ( command=="cs" || command=="as" ) v.pm.put("");
    
    if ( command=="cell" && data ) { // set a square to ship or empty
      parsed = v.parseGridId(data);
      //alert ( "cell :"+parsed.row+"_"+parsed.col );
      if (parsed.prefix=="p") {
        if ( m.playerBasin.get(parsed.row,parsed.col) != "s" ) c="s";
        else c="e";
        m.playerBasin.put(c,parsed.row,parsed.col);
        v.pb.put(c,parsed.row,parsed.col);
      }
    }

    if (command=="rs") { // remove all ships
      m.playerBasin.clear();
      v.pb.fromBasin(m.playerBasin);
    }

    if (command=="as") { // automatically draw ships
      sy=new ShipYard(g.getForces());
      ps=sy.buildAll();
      m.playerBasin.clear();
      m.playerBasin.takeShips(ps);
      v.pb.fromBasin(m.playerBasin);
    }

    if (command=="cs") { // check up and go playing
      h=new Harvester(m.playerBasin);
      h.search();
      m.playerBasin.cleanUp();
      v.pb.fromBasin(m.playerBasin);
      hs=h.yield();
      m.playerShips = new Fleet();
      m.playerShips.take(hs);
      if ( ! m.playerShips.checkMargins() ) {
        v.pm.put("Ships must be straight<br /> and not to touch each other. <br />Try new ones");
        m.playerShips.clear();
        return;
      }
      pHistogram=m.playerShips.makeHistogram();
      warrantHistogram=g.getForces();
      if ( pHistogram.join() != warrantHistogram.join() ) {
        mes="The rules require <br />(squares:ships): ";
        mes+=v.ps.showClearHistogram(warrantHistogram,"return");
        mes+='<br />Your ships does not comply';
        if ( g._demandEqualForces ) mes+="<br />Try new ones";
        v.pm.put( mes );
        if ( g._demandEqualForces ) {
          m.playerShips.clear();
          return;
        }
      }

      m.playerStat.setShips(pHistogram);
      v.ps.showStat(m.playerStat.shipsAlive,m.playerStat.biggestShip,m.playerStat.shipsSunk);
      v.ps.showClearHistogram(pHistogram);
      if (g.allowHideControls) { v.dc.hide(); }
      initFight();
    }
    return;
  };
  
  function initFight() {
    if( typeof e != "object" ) throw new Error("ShipsLocal::go: e is not the global object!");
    if( typeof p != "object" ) throw new Error("ShipsLocal::go: p is not the global object!");
    if( typeof a != "object" ) throw new Error("ShipsLocal::go: a is not the global object!");
    
    g.setStage("fight");
    
    e=new Enemy( m.enemyShips, m.enemyBasin, m.enemyStat, m.enemyClip, m.playerBasin, v.em, g._enemyStriker );
    //alert("E_hi="+e.hi());
    p=new PlayerAssistant( m.playerShips, m.playerBasin, m.playerStat, m.playerClip, v.pm );
    a=new Active(p,e,g);
    if (g._strikeRule=="bs") {
      p._clip.load();
      e._clip.load();
    }
    
    if (g._active=="p") {
      v.pm.add("<br />Make your move!"); 
      a.setPlayer();
    }
    else if (g._active=="e" ) { 
      v.em.add("Enemy has first move");
      a.setEnemy();
      e.strike();
    } 
    else throw new Error ("Invalid active side:"+g._active+"!");    
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

    v.pm.put("");
    v.em.put("");
    
    // player's strike
    if( g._active=="p" && command=="cell" && data ) {
      parsed = v.parseGridId(data);
      if ( parsed.prefix != "e" ) return;
      hit=e.respond([parsed.row,parsed.col]);
      //alert(">"+hit);
      p.reflect(hit);
      v.ps.showStrikesHits(m.playerStat.strikes,m.playerStat.hits);
      displayResponce( hit, [parsed.row,parsed.col], v.tb, m.enemyBasin, v.es, m.enemyStat, v.pm );// e.display
      if ( a.checkout(hit) ) return;
      // fall-through
    }
    
    // LocalScript's strike
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

    // fight finished
    displayElement("finish");
    if (g._active=="p") {
      g._winner="p";
      v.pm.put('<span class="'+"win"+'">YOU HAVE WON !');
    }
    else {
      g._winner="e";
      v.em.put('<span class="'+"lose"+'">ENEMY HAS WON !');
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
      //alert("g._active="+g._active);
      // Active::swap leaves g._active equal to the winning side
      var rl=new RulesLocal();
      rl.initPage2();
      break;
      
    case "new":
      g=new Global();
      g.setStage("intro");
      g.setState("zero");
      if (g.allowHideControls) { 
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