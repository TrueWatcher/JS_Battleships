"use strict";

function StatPanel(parentElm,prefix) {
  var str='Strikes:<span id="'+prefix+"Strikes"+'"></span> ';
  str+='Hits:<span id="'+prefix+"Hits"+'"></span> ';
  str+='(<span id="'+prefix+"Percent"+'"></span>%) ';
  var sh='Ships afloat:<span id="'+prefix+"Float"+'"></span> ';
  sh+='largest:<span id="'+prefix+"Largest"+'"></span> ';
  sh+='dead:<span id="'+prefix+"Dead"+'"></span> ';
  var hist='Ships all (squares:ships): <span id="'+prefix+"Hist"+'"></span> ';
  this._html=hist+"<br />"+str+"<br />"+sh+"<br />";
  this._e=parentElm;
  this._e.innerHTML=this._html;
  this._prefix=prefix;
  
  this.showStrikesHits=function(strikes,hits) {
    putToElement(strikes,this._prefix+"Strikes");
    putToElement(hits,this._prefix+"Hits");
    if (strikes) putToElement(Math.round(100*hits/strikes),this._prefix+"Percent");    
  }
  
  this.showStat=function(afloat,biggest,sunk) {
    putToElement(afloat,this._prefix+"Float");    
    putToElement(biggest,this._prefix+"Largest");
    putToElement(sunk,this._prefix+"Dead");    
  }
}

StatPanel.prototype.showClearHistogram=function(histogram,id) { 
    var hst="";
    for (var l=0;l<DIM;l++) {
      if (histogram[l]) {
        hst+=""+l+":"+histogram[l]+"  ";
      }
    }
    if ( id=="return" ) return(hst);
    if ( !id ) var id=this._prefix+"Hist";
    putToElement(hst,id);
} 

function AsciiTheme() {
  this._lookup={ "u":' ',"e":'.',"s":'#',"m":'~',"h":'@',"w":'%',"c":'-',"f":'X' };
  
  this.put=function(what,row,col,idPrefix) {
    if ( !this._lookup[what] ) throw ("AsciiTheme::put: invalid argument "+what);
    var id=""+idPrefix+row+col;
    var td=document.getElementById(id);
    td.innerHTML=this._lookup[what];
  }
  
  this.get=function(row,col,idPrefix) {
    var id=""+idPrefix+row+col;
    var td=document.getElementById(id);
    var val=td.innerHTML;
    var key=this._lookup.getKeyByValue(val);
    return (key);
  }   
}

function ClassTheme(themedir,stylesheet) {
  this._allowed=[ "u","e","s","m","h","w","c","f" ];
  
  this.put=function(what,row,col,idPrefix) {
    if ( this._allowed.indexOf(what) < 0 ) throw ("ClassTheme::put: invalid argument "+what);
    var id=""+idPrefix+row+col;
    var td=document.getElementById(id);
    td.className=what; 
  }
  
  this.get=function(row,col,idPrefix) {
    var id=""+idPrefix+row+col;
    var td=document.getElementById(id);
    return ( td.className );
  }
  
  this.addStyleSheet=function(themedir,stylesheet) {
    var l=document.createElement("link");
    l.type = 'text/css';
    l.rel = 'stylesheet';
    l.href = themedir+stylesheet;
    document.head.appendChild(l);
    
    (new Image).src=themedir+"buoy.png";
    (new Image).src=themedir+"sunk.png";
    (new Image).src=themedir+"expl.png";
    (new Image).src=themedir+"splash.png";
    (new Image).src=themedir+"burn.png";
  }
  
  this.addStyleSheet(themedir,stylesheet);
}

//var classTheme1=new ClassTheme("classTheme1/","classTheme1.css");

function Board(parentElm,command,prefix,fill,theme) {
  this._theme=theme;  
  this._fill=fill;
  this._idPrefix=prefix;
  
  this.makeGrid=function (prefix) {
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
  
  this._html=this.makeGrid(prefix);
  this._e=parentElm;
  this._e.innerHTML=this._html;

  this.detectTd=function(event) {
    // http://javascript.info/tutorial/event-delegation
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
  
  var _this=this;
  
  this._e.onclick=function(event) {
    //alert (event.target.nodeName);
    var tdId=_this.detectTd(event);
    //alert (tdId);
    go ( command, [ tdId.charAt(1),tdId.charAt(2) ] );
  }
  
  this.put=function(row,col,what) {
    this._theme.put(what,row,col,this._idPrefix);
  }

  this.get=function(row,col) {
    return( this._theme.get(row,col,this._idPrefix) );
  }
  
  this.fill=function() {
    for (var row=0;row<DIM;row++) {
      for (var col=0;col<DIM;col++) {
        this.put(row,col,this._fill);
      }
    }
  }
  
  this.fill();
  
  this.toBasin=function(basin) {
    var rc,range=new Seq2d();
    while ( rc=range.go() ) {
      basin.put( this.get(rc[0],rc[1]), rc[0], rc[1] );
    }
  }
  
  this.fromBasin=function(basin) {
    var rc,range=new Seq2d();
    while ( rc=range.go() ) {
      this.put( rc[0],rc[1],basin.get( rc[0],rc[1] ) );
    }
  }
}// end Board

function DrawControls() {
  var dc="";
  dc+='<button type="button" id="confirmShips" onclick="go('+"'cs'"+')" >'+"Done, let's play"+'</button>';
  dc+='<button type="button" id="removeShips" onclick="go('+"'rs'"+')" >'+"Clear"+'</button>';
  dc+='<button type="button" id="autoShips" onclick="go('+"'as'"+')" >'+"Auto"+'</button>';
  
  this._e=document.getElementById("prPanel");
  this._e.innerHTML=dc;
  this._e.style.display="none";
  
  this.toggle=function() {
    toggleElement(this._e);
  } 
}

function MessagePanel(elementId) {
  this._mes="";
  this._id=elementId;
  
  this.put=function(str) {
    this._mes=str;
    putToElement(this._mes,this._id);
  }
  
  this.add=function(str) {
    this._mes+=" "+str;
    putToElement(this._mes,this._id);    
  }
}

function RulesForm(g) {
  if (!g) return; // View() is used in unit tests, they don't need this form
  var rf="";
  rf+='<label for="playerName">Your name :</label>';
  rf+='<input type="text" name="playerName" id="playerName" value="You" />';
  rf+="&nbsp; &nbsp;";
  rf+='<label for="enemyName">Your opponent'+"'"+'s name :</label>';
  rf+='<input type="text" name="enemyName" id="enemyName" value="Local Script" />';  
  rf+='<br />';
  rf+='Ships (squares:quantity) : ';
  var his1=StatPanel.prototype.showClearHistogram(g._forces1,"return");
  rf+=his1+'<input type="radio" name="forces" id="forces1" value="'+1+'" checked="checked" />';
  rf+="&nbsp; &nbsp;";
  var his2=StatPanel.prototype.showClearHistogram(g._forces2,"return");
  rf+=his2+'<input type="radio" name="forces" id="forces2" value="'+2+'" />';
  rf+='<br />';
  rf+='Strikes per move : ';
  rf+="one plus extra one for each hit"+'<input type="radio" name="strikes" id="strikes1" value="'+"oe"+'" checked="checked" />';
  rf+="&nbsp; &nbsp;";
  rf+="as many as is the size of the biggest alive ship"+'<input type="radio" name="strikes" id="strikes2" value="'+"bs"+'" />';
  rf+='<br />';
  rf+='Difficulty : ';
  rf+="cheat"+'<input type="radio" name="level" id="level1" value="'+"cheat"+'" />';
  rf+="&nbsp; &nbsp;";
  rf+="easy"+'<input type="radio" name="level" id="level2" value="'+"easy"+'" />';
  rf+="&nbsp; &nbsp;";
  rf+="full"+'<input type="radio" name="level" id="level3" value="'+"full"+'" checked="checked" />';  
  rf+='<br />';  
  rf+='Theme : ';
  rf+="icons"+'<input type="radio" name="theme" id="theme1" value="'+"icons"+'" checked="checked" />';
  rf+="&nbsp; &nbsp;";
  rf+="ascii chars"+'<input type="radio" name="theme" id="theme2" value="'+"ascii"+'" />';  
  rf+='<br />';  
  rf+='<p style="text-align: center;"><input type="submit" value="Done" /></p>';
  rf='<form action="javascript:;" onsubmit="go();return (false);"><div>'+rf+'</div></form>';
  
  this._e=document.getElementById("rulesForm");
  this._e.innerHTML=rf;
  
  this.toggle=function() {
    toggleElement(this._e);
  }
}

function View(game) {
  if (game) this.rf=new RulesForm(game);// View() is used in unit tests that don't need rulesForm
  
  this.dc=new DrawControls();
  //var _this=this;

  this.ps=new StatPanel( document.getElementById("playerStat"),"p" );
  this.es=new StatPanel( document.getElementById("enemyStat"),"e" );
  
  this.pm=new MessagePanel("playerMsg");
  this.em=new MessagePanel("enemyMsg");
  
  this.setBoards=function(theme) {
    var myTheme=new AsciiTheme;
    if (theme && theme=="icons1") myTheme=new ClassTheme("classTheme1/","classTheme1.css");;
  
    this.pb=new Board( document.getElementById("primary"),"set","p","e",myTheme );
    this.tb=new Board( document.getElementById("tracking"),"strike","e","u",myTheme );
  }
  
  if (!game) this.setBoards("ascii");// View() is used in unit tests
} 



