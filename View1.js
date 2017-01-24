
function ClassThemeV1(themedir,stylesheet,table,View,pSide,eSide) {
  if (instance) { return (instance); }
  this.label="classTheme1";
  var l;
  
  function addStyleSheet(themedir,stylesheet) { // private method
    l=document.createElement("link");
    l.type = 'text/css';
    l.rel = 'stylesheet';
    l.href = themedir+stylesheet;
    document.head.appendChild(l);
  }
  
  this.detach=function() {
    if (true || isOn) { 
      //alert("removing css");
      document.head.removeChild(l);
    }
  }
  
  function paintSide(side,cls) {
    if ( side!=="A" && side!=="B" ) return;//throw new Error("paintSide: empty side");
    var ti=new TdIterator(table);
    var td,parts;
    while ( td=ti.go() ) {
      if (td.id) {
        parts=View.parsePickId(td.id);
        if ( parts.side===side ) td.className=cls;
      }
    }
    var labelId="label"+side;
    $(labelId).className=cls;
  }
  
  this.apply=function() {
    addStyleSheet(themedir,stylesheet);
    if (pSide && eSide) {
      paintSide(pSide,"pl");
      paintSide(eSide,"");
    }
  };
  
  var instance=this;
}

function DummyTheme() {
  this.detach=function(){};
  this.apply=function(){};
  this.label="dummyTheme";
}

function View1() {

  this._theme="ascii";
  var myTheme=new DummyTheme;
  
  this.applyTheme=function() {
    this.readTheme();
    //g._theme=this._theme; delegated to controller
    //alert("applying "+myTheme.label+"/"+this._theme);
    if (this._theme=="icons1") { 
      myTheme=new ClassThemeV1 ( "classTheme1/", "classTheme1.css", $("picksTable"), this, g.pSide, g.eSide );
      myTheme.apply();
      return this._theme;
    }
    else if (this._theme=="ascii") { 
      myTheme.detach();
      myTheme=new DummyTheme();
      return this._theme;
    } 
    else throw new Error ("applyTHeme: invalid theme :"+this._theme+"!");
  }
  
  this.readTheme=function() {
    if ( $("theme1").checked ) this._theme="icons1";
    else this._theme="ascii";
    return (this._theme);
  };
  
  this.ticks={A:"a",B:"b"};
  
  this.clearNames=function() {
    $("nameA").innerHTML="";
    $("nameB").innerHTML="";
  };
  
  this.putNames=function(nA,nB) {
    if (!nA || !nB) throw new Error("View1::putNames: empty argument(s) 1:"+nA+",2:"+nB+"!");
    $("nameA").innerHTML=nA;
    $("nameB").innerHTML=nB;    
  };
  
  this.getNames=function() {
    var pn=$("playerName").value;
    var en=$("enemyName").value;
    if (!pn || !en) {
      alert("Please, give your name and other player's name");
      return false;
    }
    if ( en!=="Local Script" && pn==="You" ) {
      alert("Please, give your name, which must be known to the other player");
      return false;
    }
    return({ "p":pn, "e":en });
  };
  
  this.putNote=function(stage,note) {
    if (!note) note=g.message;
    if (!stage || stage=="zero") stage="intro";
    var id=stage+"Note";
    $(id).innerHTML=note;
  };
  
  this.clearNote=function(stage) {
    if (!stage || stage=="zero") stage="intro";
    var id=stage+"Note";
    $(id).innerHTML="";      
  };
  
  this.tickHtml=function(id,itemName,row,side) {
    var el;
    if (id) el=$(id); 
    else el=$(itemName+"_"+row+"_"+side);
    var val=el.innerHTML;
    var tickSymbol="v";
    if ( !val ) el.innerHTML=tickSymbol;
    else el.innerHTML="";
  };
  
  this.clearGroup=function(itemName,row,side) {
    var ti=new TdIterator($("picksTable"));
    var td,parsed;
    while ( td=ti.go() ) {
      parsed=this.parsePickId(td.id);
      if (parsed.side==side && parsed.itemName==itemName) {
        td.innerHTML=""; 
      }
    }
  };

  this.parsePickId=function(tdId) {
    var parts=[];
    if ( !tdId || !tdId.length ) throw new Error ("parsePickId: empty argument");
    parts=tdId.split("_");
    if ( !parts[0] || !parts[1] || !parts[2] ) throw new Error ("parsePickId: invalid argument:"+tdId+"!");
    return ( { itemName : parts[0], row: parts[1], side: parts[2] } );
  };
  
  this.readPicks=function (side) {
    var ti=new TdIterator($("picksTable"));
    var td, parts={}, res=[], pair='"key":val', json="{}";
    var joined="";
    
    while ( td=ti.go() ) {
      //alert (">"+td.id);
      parts=this.parsePickId(td.id);
      if (parts.side==side && td.innerHTML) {
        joined=res.join(",");
        if ( joined.indexOf(parts.itemName) >= 0 ) { 
          alert("Please, select only one answer on each issue");
          return false;
        }
        else {
          pair='"'+parts.itemName+'":'+parts.row;
          res.push(pair);
        }
      }
    }
    //if ( res.length==0 ) throw new Error("readPicks: no picks found");
    json="{"+res.join(",")+"}";
    //alert("picked:"+json);
    return json;
  };

  this.drawPicks=function(side,json,symbol) {
    var pairs={};
    if ( json instanceof Object ) pairs=json;
    else pairs=JSON.parse(json);  
    var ti=new TdIterator($("picksTable"));
    var td, parts={};
    while ( td=ti.go() ) {
      parts=this.parsePickId(td.id);
      if ( parts.side==side ) {
        if ( parts.itemName && pairs[parts.itemName] == parts.row ) td.innerHTML=symbol;
        else td.innerHTML="";      
      }
    }
  };

  this.initPicks=function() {
    //alert("initPicks "+g.getStage());
    var ti=new TdIterator($("picksTable"));
    var td,parts;
    while ( td=ti.go() ) { //td.innerHTML=""; }
    // default is 0th, skip "confirm"
      parts=this.parsePickId(td.id);
      //alert(parts.itemName);
      if ( parts.itemName != "confirm" ) {
        //alert(ticks[parts.side]);
        if ( parts.row==0 ) td.innerHTML=this.ticks[parts.side];
        else td.innerHTML="";
      }
    }
  };
      
  //----- event handlers -----
  this.setClickHandlers=function() {
    // select theme
    $("themeRadio").onclick=function () { tm.go("intro","setTheme"); /*return false;*/ };
    
    // submit username form
    $("connectButton").onclick=function() { tm.go("intro","register"); return false; };

    // click on an answer
    $("picksTable").onclick=function(event) {
      if (g.getState == "connecting") {
        alert("Please, wait for connect");
        return false;
      }
      var tdId=detectTd(event);
      if (tdId) tm.go("rules","updPick",tdId);
      return false;
    };

    // click on CONFIRM button
    $("confirmButton").onclick=function() { tm.go("rules","confirm"); return false; };

    $("resetButton").onclick=function() {
      /*if ( g.getState()=="picking" || g.getState()=="converged" || g.getState()=="confirming" ) {
        alert ("This button does not work in active state");
        return false;
      }*/
      tm.go("intro","abort");
      return false;
    };

    $("localButton").onclick=function() { tm.go("intro","playLocally"); return false; };

    $("moreButton").onclick=function() { tm.go("finish","more"); return false; };
    
    $("newButton").onclick=function() { tm.go("finish","new"); return false; };
    
    $("quitButton").onclick=function() { tm.go("finish","quit"); return false; };
    
  };
  
  this.consumeServerResponse=function(r) {
    if ( typeof r !== "object" ) throw new Error ("View1::consumeServerResponse : non-object argument");
    if ( r["players"] ) {
      //processRegistration();
      var rp=r["players"];
      v1.putNames(rp["A"],rp["B"]);
      //if ( rp[g.pSide] != g.pName ) throw new Error("My name is "+g.pName+" in the cookie and "+rp[g.pSide]+" in the response!");
    }
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
      switch ( g.getStage() ) {
      case "":
      case "zero":
      case "intro":
        v1.putNote("intro",message);
        break;
      case "rules":
        v1.putNote("rules",message);
        break;
      }
    }
    message="";
    if ( r.hasOwnProperty("picks") ) {
      var rpp=r["picks"];
      if ( rpp["A"] ) { this.drawPicks("A",rpp["A"],this.ticks["A"]); }
      //alert( "!"+rpp.hasOwnProperty("B") );
      if ( rpp["B"] ) { 
        //alert(rpp["B"]);
        this.drawPicks("B",rpp["B"],this.ticks["B"]); 
      } 
    }
  };

}// end View1
