"use strict";

/**
 * Defines the strategy to display board cells. This one uses simple ASCII chars.
 * @constructor
 * @method put
 * @method get
 */
function AsciiTheme() {
  var _lookup={ "u":' ',"e":'.',"s":'#',"m":'~',"h":'@',"w":'%',"c":'-',"f":'X' };// closure for private property

  this.put=function(what,row,col,idPrefix) {
    var id="";
    if (what=="n") return;
    if ( !_lookup[what] ) throw new Error("AsciiTheme::put: invalid argument "+what);
    id=""+idPrefix+row+col;
    putToElement(_lookup[what],id);
  };

  this.get=function(row,col,idPrefix) {
    var id=""+idPrefix+row+col;
    var td=document.getElementById(id);
    var val=td.innerHTML;
    var key=_lookup.getKeyByValue(val);
    return (key);
  };
}

/**
 * Defines the strategy to display board cells. This one uses classes and CSS table.
 * @constructor
 * @param string themedir folder for CSS table and pictures
 * @param string stylesheet name of CSS table
 * @method put
 * @method get
 */
function ClassTheme(themedir,stylesheet) {
  var _allowed=[ "u","e","s","m","h","w","c","f" ];// private via closure

  this.put=function(what,row,col,idPrefix) {
    if (what=="n") return;
    if ( _allowed.indexOf(what) < 0 ) throw new Error("ClassTheme::put: invalid argument "+what);
    var id=""+idPrefix+row+col;
    var td=document.getElementById(id);
    td.className=what;
  };

  this.get=function(row,col,idPrefix) {
    var id=""+idPrefix+row+col;
    var td=document.getElementById(id);
    return ( td.className );
  };

  function addStyleSheet(themedir,stylesheet) { // private method
    var l=document.createElement("link");
    l.type = 'text/css';
    l.rel = 'stylesheet';
    l.href = themedir+stylesheet;
    document.head.appendChild(l);
  }

  function images2cache() { // private method
    (new Image).src=themedir+"buoy.png";
    (new Image).src=themedir+"sunk.png";
    (new Image).src=themedir+"expl.png";
    (new Image).src=themedir+"splash.png";
    (new Image).src=themedir+"burn.png";
  }

  //addStyleSheet(themedir,stylesheet);
  images2cache();
}

/**
 * Game field 10*10, fully clickable.
 * @constructor
 * @param {DOMElement|string} parentElm a container element
 * @param string command a Controller command to attach to cells clicks
 * @param string prefix prefix for cells's ids
 * @param string fill character to fill a new board (see Basin)
 * @param object theme strategy to display cells
 * @see putToElement()
 */
function Board(parentElm,command,prefix,fill,theme) {
  if ( typeof theme.put != "function" || typeof theme.get != "function" ) throw new Error ("Board: invalid theme");
  /*var e;// private
  if(typeof parentElm == "string") e=document.getElementById(parentElm);
  else if (parentElm.nodeName) e=parentElm;
  else throw new Error("Board: invalid argument parentElm");*/
  if(typeof parentElm == "string") parentElm=document.getElementById(parentElm);

  /**
   * Makes a HTML TABLE with DIM*DIM cells.
   * @param string prefix a letter to use as prefix for TDs' ids like id="p04"
   * @return string HTML code
   * @private
   * @see putToElement
   */
  function makeGrid(prefix) { // private method
    //alert("Board::makeGrid");
    var row,col;
    var td,tr,table="";
    for (row=0;row<DIM;row++) {
      tr="<tr>";
      for (col=0;col<DIM;col++) {
        td='<td id="'+prefix+row+col+'">'+'</td>';
        tr+=td;
      }
      tr+="</tr>";
      table+=tr;
    }
    table='<table class="'+"board"+'">'+table+"</table>";
    return (table);
  }

  var html=makeGrid(prefix);
  putToElement(html,parentElm);

  /**
   * Utilizes the Event Delegation pattern: detects the id of clicked square
   * @see http://javascript.info/tutorial/event-delegation
   * @return {string|false} the id of clicked TD element or false if border is clicked
   * @private
   */
  function detectTd(event) { // private method
    event = event || window.event;
    var target = event.target || event.srcElement;

    while(target.nodeName != 'TABLE') {
      if (target.nodeName == 'TD') {
        return (target.id);
      }
    target = target.parentNode;
    }
    return (false);
  }

  //var _this=this;

  parentElm.onclick=function(event) {
    //alert (event.target.nodeName);
    var tdId=detectTd(event);// closure
    //var data=[ tdId.charAt(1),tdId.charAt(2) ];
    //alert (tdId);
    //alert("stage "+g.getStage());
    tm.go ( g.getStage(), "cell", tdId );
    return false;
  };

  this.put=function(what,row,col) {
    if (row instanceof Array) {
      col=row[1];
      row=row[0];
    }
    theme.put(what,row,col,prefix);
  };

  this.get=function(row,col) {
    if (row instanceof Array) {
      col=row[1];
      row=row[0];
    }
    return( theme.get(row,col,prefix) );
  };

  this.fill=function() {
    var rc,range=new Seq2d();
    while ( rc=range.go() ) {
      this.put(fill,rc);
    }
  };

  this.fill();

  this.toBasin=function(basin) {
    var rc,range=new Seq2d();
    while ( rc=range.go() ) {
      basin.put( this.get(rc), rc );
    }
  };

  this.fromBasin=function(basin) {
    var rc,range=new Seq2d();
    while ( rc=range.go() ) {
      this.put( basin.get(rc),rc );
    }
  };
}// end Board

/**
 * Buttons to manage drawing of player's ships. Can be turned off when not needed.
 * @constructor
 * @see toggleElement
 */
function DrawControls() {
  $("confirmShips").onclick=function(){ tm.go("ships","cs"); return false; };
  $("removeShips").onclick=function(){ tm.go("ships","rs"); return false; };
  $("autoShips").onclick=function(){ tm.go("ships","as"); return false; };

  this._e=document.getElementById("prPanel");
  //this._e.style.display="none";

  this.toggle=function() {
    toggleElement(this._e);
  };
}

/**
 * A panel to show messages
 * @constructor
 * @param string elementId a container element
 * @see putToElement
 */
function MessagePanel(elementId) {
  var _mes="";// private via closure
  //var _id=elementId;

  this.put=function(str) {
    _mes=str;
    putToElement(_mes,elementId);
  };

  this.add=function(str) {
    _mes+=" "+str;
    putToElement(_mes,elementId);
  };
}

/**
 * A panel to show statistics
 * @constructor
 * @param string elementId a container element
 * @param string prefix prefix for ids
 * @see putToElement
 */
function StatPanel(parentElm,prefix) {
  this._prefix=prefix;// required by StatPanel.prototype.showClearHistogram
  if(typeof parentElm == "string") parentElm=document.getElementById(parentElm);

  var str='Strikes:<span id="'+prefix+"Strikes"+'"></span> ';
  str+='Hits:<span id="'+prefix+"Hits"+'"></span> ';
  str+='(<span id="'+prefix+"Percent"+'"></span>%) ';
  var sh='Ships afloat:<span id="'+prefix+"Float"+'"></span> ';
  sh+='largest:<span id="'+prefix+"Largest"+'"></span> ';
  //sh+='dead:<span id="'+prefix+"Dead"+'"></span> ';
  var hist='Ships all (squares:ships): <span id="'+prefix+"Hist"+'"></span> ';
  var html=hist+"<br />"+str+"<br />"+sh+"<br />";
  putToElement(html,parentElm);

  this.showStrikesHits=function(strikes,hits) {
    putToElement(strikes,prefix+"Strikes");
    putToElement(hits,prefix+"Hits");
    if (strikes) putToElement(Math.round(100*hits/strikes),prefix+"Percent");
  };

  this.showStat=function(afloat,biggest,sunk) {
    putToElement(afloat,prefix+"Float");
    putToElement(biggest,prefix+"Largest");
    //putToElement(sunk,prefix+"Dead");
  };
  
  this.toggle=function() {
    toggleElement(parentElm);
  };
}

/**
 * Presents histogram as pairs size:quantity
 * @param array histogram (see Model::Fleet)
 * @param string id container element or "return" to just return the result
 * @return nothing|string
 * @see putToElement
 * @see Fleet::makeHistogram
 */
StatPanel.prototype.showClearHistogram=function(histogram,id) {
    var l, hst="", id ;
    for (l=0;l<DIM;l++) {
      if (histogram[l]) {
        hst+=""+l+":"+histogram[l]+"  ";
      }
    }
    if ( id=="return" ) return(hst);
    if ( !id ) id=this._prefix+"Hist";
    putToElement(hst,id);
}

function View(game) {
  //if (game) this.rf=new RulesForm(game);// View() is used in unit tests that don't need rulesForm

  this.dc=new DrawControls();

  this.ps=new StatPanel( "playerStat","p" );
  this.es=new StatPanel( "enemyStat","e" );

  this.pm=new MessagePanel("playerMsg");
  this.em=new MessagePanel("enemyMsg");

  this.setBoards=function(theme) {
    var myTheme={};
    if (theme && theme=="icons1") myTheme=new ClassTheme("classTheme1/","classTheme1.css");
    else myTheme=new AsciiTheme();

    this.pb=new Board( "primary","set","p","e",myTheme );
    this.tb=new Board( "tracking","strike","e","u",myTheme );
  };
  
  if (!game) this.setBoards("ascii");// View() is used in unit tests
  
  this.putNames=function() {
    if (!game) return;
    putToElement(game.pName,"playerLabel");
    putToElement(game.eName,"enemyLabel");
  }
  
  this.parseGridId=function(tdId) {
    if (!tdId) return false;
    var prefix=tdId.charAt(0);
    var row=tdId.charAt(1);
    var col=tdId.charAt(2);
    return ({ prefix:prefix, row:row, col:col });
  }
  
  this.consumeServerResponse = function(r,m) {
    var parsed={};
    //var targetBasin,targetBoard;
    //var side="",rc=[],hit="",sunk=[];
    
    if ( typeof r !== "object" ) throw new Error ("View1::consumeServerResponse : non-object argument");
    
    var message="";
    if ( r["error"] ) {
      message+=" Error! ";
    }
    if ( r["note"] ) {
      message+=r["note"];
    }
    else {
      message=" ";
    }
    if (message || true) {
      this.pm.put(message);
    }
    message="";
    
    if ( r["players"] ) {
      var rp=r["players"];
      putToElement(rp[g.pSide],"playerLabel");
      putToElement(rp[g.eSide],"enemyLabel");
    }
    
    if ( r["fleet"] ) {
      //alert("fleet");
      var sh=r["fleet"];
      if ( !( sh["A"] instanceof Array ) && ! ( sh["B"] instanceof Array ) ) throw new Error ("No valid index A or B in r::ships");
      if ( sh[g.pSide] ) {
        m.playerBasin.takeShips(sh[g.pSide]);
        this.pb.fromBasin(m.playerBasin);
      }
      if ( sh[g.eSide] ) {
        m.enemyBasin.takeShips(sh[g.eSide]);
        this.tb.fromBasin(m.enemyBasin);
      }
    }
    
    if ( r["moves"] ) {
      //if ( !is_array(r["moves"]["A"]) && !is_array(r["moves"]["B"]) ) throw new Error ("Not  arrays :"+r["moves"]["A"]+","+r["moves"]["B"]+"!");
      var i=0,both=[];
      both=r["moves"];
      //if ( is_array(r["moves"]["A"]) ) both=both.concat( r["moves"]["A"] );
      //if ( is_array(r["moves"]["B"]) ) both=both.concat( r["moves"]["B"] );          
      for (i=0;i<both.length;i++) { this.putMove(both[i]); } // order between sides is not guranteed
    }    
    
    if ( r["move"] ) {
      //if (!is_array(r["move"])) throw new Error ("Not an array :"+r["move"]+"!");
      this.putMove( r["move"] );
    }
    
    if ( r["stats"] ) {
      var st=r["stats"];
      if ( !( st["A"] instanceof Object ) || ! ( st["B"] instanceof Object ) ) throw new Error ("No valid index A and B in r::stats");
      this.ps.showStrikesHits( st[g.pSide]["strikes"], st[g.pSide]["hits"] );
      this.es.showStrikesHits( st[g.eSide]["strikes"], st[g.eSide]["hits"] );
      this.ps.showStat( st[g.pSide]["afloat"], st[g.pSide]["largest"], "" );
      this.es.showStat( st[g.eSide]["afloat"], st[g.eSide]["largest"], "" );
    }
    
  };
  
  this.parseMove=function(move) {
    if ( ! ( move instanceof Array ) ) throw new Error ("Not array :"+move+"!");
    var parsed={};
    parsed.count=move[0];
    parsed.side=move[1];
    parsed.row=move[2];
    parsed.col=move[3];
    parsed.hit=move[4];
    if (move[5]) parsed.sunk=move[5];
    return parsed;
  };
  
  this.putMove=function(moveArr){
    var parsed={};
    var targetBasin,targetBoard;
    //alert (">>"+moveArr);
    parsed = this.parseMove(moveArr);
    if (parsed.side == g.eSide) { // if e strikes, target is p
      targetBasin=m.playerBasin;
      targetBoard=this.pb;
    }
    else if (parsed.side == g.pSide) {
      targetBasin=m.enemyBasin;
      targetBoard=this.tb;
    } 
    else {
      throw new Error ("Invalid r::moves side:"+parsed.side+"!");  
    }
    if ( parsed.sunk ) {
      if (!is_array(parsed.sunk)) throw new Error ("Not an array "+parsed.sunk+"!");
      targetBasin.markSunk( parsed.sunk );
      targetBasin.markAround ( parsed.sunk );
      targetBoard.fromBasin( targetBasin );
    }
    else {
      targetBasin.put( parsed.hit,parsed.row,parsed.col );
      targetBoard.put( parsed.hit,parsed.row,parsed.col );
    }
    g.incTotal();    
  }
}



