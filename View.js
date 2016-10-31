"use strict";

function StatPanel(parentElm,prefix,mode) {
  var str='Strikes:<span id="'+prefix+"Strikes"+'"></span> ';
  str+='Hits:<span id="'+prefix+"Hits"+'"></span> ';
  str+='(<span id="'+prefix+"Percent"+'"></span>%) ';
  var sh='Ships afloat:<span id="'+prefix+"Float"+'"></span> ';
  sh+='largest:<span id="'+prefix+"Largest"+'"></span> ';
  sh+='dead:<span id="'+prefix+"Dead"+'"></span> ';
  var hist='Ships all (decks:pieces): <span id="'+prefix+"Hist"+'"></span> ';
  this._html=str+"<br />"+sh+"<br />"+hist;
  this._e=parentElm;
  this._e.innerHTML=this._html;
  this._prefix=prefix;

  this.showClearHistogram=function(histogram) { 
    var hst="";
    for (var l=0;l<DIM;l++) {
      if (histogram[l]) {
        hst+=""+l+":"+histogram[l]+"  ";
      }
    }
    putToElement(hst,this._prefix+"Hist");
    //alert(hst);
    //this.showHistogram(hst);
    //return(hst);
  }  
  
  /*this.showHistogram=function(str) {
    var e=document.getElementById(this._prefix+"Hist");
    e.innerHTML=str;
  }*/
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

function Board(parentElm,command,prefix,fill) {
  this._theme={ u:' ',e:'.',s:'#',m:'~',h:'@',w:'&',c:'-' };  
  this._fill=fill;
  this._idPrefix=prefix;
  this._html=makeGrid(prefix,this._theme[fill]);
  this._e=parentElm;
  this._e.innerHTML=this._html;  
  
  this._e.onclick=function(event) {
    //alert (event.target.nodeName);
    var tdId=detectTd(event);
    //alert (tdId);
    go(command,tdId.charAt(1),tdId.charAt(2));
  }
  
  this.put=function(row,column,what) {
    var id=""+this._idPrefix+row+column;
    var td=document.getElementById(id);
    td.innerHTML=this._theme[what];
  }
  
  this.check=function(row,column,what) {
    var id=""+this._idPrefix+row+column;
    var td=document.getElementById(id);
    if( td.innerHTML === this._theme[what] ) return(true);
    return(false);    
  }
  
  this.get=function(row,column) {
    var id=""+this._idPrefix+row+column;
    var td=document.getElementById(id);
    var val=td.innerHTML;
    var key=this._theme.getKeyByValue(val);
    return (key);
  } 
  
  this.toBasin=function(basin) {
    var rc,range=new Seq2d();
    while ( rc=range.go() ) {
      basin.put( this.get(rc[0],rc[1]),rc[0],rc[1] );
    }
  }
  
  this.fromBasin=function(basin) {
    var rc,range=new Seq2d();
    while ( rc=range.go() ) {
      this.put( rc[0],rc[1],basin.get( rc[0],rc[1] ) );
    }
  }
}

function makeGrid(prefix,fill) {
  var row,col;
  var td,tr,table="";
  for (row=0;row<DIM;row++) {
    tr="<tr>";
    for (col=0;col<DIM;col++) {
      td='<td id="'+prefix+row+col+'">'+fill+'</td>';
      tr+=td;
    }
    tr+="</tr>";
    table+=tr;
  }
  table="<table>"+table+"</table>";
  //alert(table);
  return (table);  
}

function detectTd(event) {
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

function View() {
  this.pb=new Board( document.getElementById("primary"),"set","p","e" );
  this.tb=new Board( document.getElementById("tracking"),"strike","e","u" );
  this.pp=document.getElementById("prPanel");
  var _this=this;
  
  this.showConfirmShips=function(){
    var cb="";
    cb+='<button type="button" id="confirmShips" onclick="go('+"'cs'"+')" >'+"My ships are ready"+'</button>';
    _this.pp.innerHTML=cb;
  }
  
  this.hideConfirmShips=function(){
    _this.pp.innerHTML="";
  }
  
  this.ps=new StatPanel( document.getElementById("playerStat"),"p","player" );
  this.es=new StatPanel( document.getElementById("enemyStat"),"e","enemy" );
} 

//var pg=new Board( 10,document.getElementById("primary"),"set","." );

