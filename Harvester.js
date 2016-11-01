"use strict";

function Harvester(basin,mode) {
  this._mode=mode;// search fight
  this._b=basin;
  this._stage="search";// search oneHit direction kill finish
  this.source=new Seq2d();
  //this.source=new Rand2d();
  this._hits=[];
  this._nearHits=[];
  this._ships=[];
  this._dir="";
  this._row=-1;
  this._col=-1;
  this._fix;
  this._mov;
  this._lowStop=0;
  this._highStop=0;
  this._probe=[];
  this._count=0;

  this.genSeqn=function() {
    var probe;
    while( !this._b.checkStrikable( probe=this.source.go() ) ) {
      this._count++;
      if (probe===false || this._count==(DIM*DIM+1) ) return(false);
    }
    this._probe=probe;
    return (probe);
  }
  
  

  this.initGenNear=function() {
    var h0=this._hits[0];
    this._nearHits=this._b.adjStrikable( h0[0],h0[1],"cross" );
    //alert("nearhits:"+this._nearHits.length);
  } 
  
  this.genNear=function() {
    var probe;
    if (this._nearHits.length==0) return (false);
    probe=this._nearHits.pop();
    this._probe=probe;
    return(probe);
  }
  
  this.initGenStraight=function() {
      var h0=this._hits[0];
      var h1=this._hits[1];
      if( h0[0]===h1[0] ) {
        //this._dir="row";
        this._fix=0;
        this._mov=1;
        this._row=h0[0];
      }
      if( h0[1]===h1[1] ) {
        //this._dir="col";
        this._fix=1;
        this._mov=0;
        this._col=h0[1];
      }
      if( h0[0]==h1[0] && h0[1]==h1[1]) throw("Harvester::initGenStraight: duplicate hits");
      if( h0[0]!==h1[0] && h0[1]!==h1[1]) alert("Harvester::initGenStraight: unadjacent hits");
      if ( h1[this._mov] < h0[this._mov] ) arraySwap01(this._hits);
      //alert ( "from "+this._hits[0].join()+" to "+this._hits[1].join() );
      this._lowStop=false;
      this._highStop=false;
  }
  
  this.genStraight=function() {
    var probe;
    var nextLow,nextHigh;
 
    var l=this._hits.length;
    //alert("L:"+l+" 1 lowstop:"+this._lowStop+" highstop:"+this._highStop);
    
    if(this._mov){ // mov=1=col fix=0=row
      nextLow=[ this._row,(this._hits[0][this._mov]-1) ];
      nextHigh=[ this._row,(this._hits[l-1][this._mov]+1) ];
    }
    else { // mov=0=row fix=1=col
      nextLow=[ (this._hits[0][this._mov]-1),this._col ];
      nextHigh=[ (this._hits[l-1][this._mov]+1),this._col ];      
    }
    
    if ( this._hits[0][this._mov]===0 || !this._b.checkStrikable(nextLow) ) this._lowStop=1;
    
    if ( this._hits[l-1][this._mov] == (DIM-1) || !this._b.checkStrikable(nextHigh) ) this._highStop=1;
    //alert("2 lowstop:"+this._lowStop+" highstop:"+this._highStop);
    if ( this._lowStop && this._highStop ) return false;
    
    if ( !this._lowStop ) {
      probe=nextLow;
      this._dir="low";
    }
    //if ( !this._highStop ) {
    else {
      probe=nextHigh;
      this._dir="high";
    }
    //alert("Going "+this._dir);
    this._probe=probe;
    return probe;
  }
  
  this.move=function() {
    var probe;
    //alert("move");
    if (this._stage=="straight") {
      if ( (probe=this.genStraight())===false ) {
        this._stage="kill";
      }
      else return(probe);      
    }
    // fall-through
    if (this._stage=="near") {
      if ( (probe=this.genNear())===false ) {
        this._stage="kill";
      }
      else return(probe);
    }
    // fall-through
    if (this._stage=="kill") {
      this.harvest();
      this._stage="search";
    }
    // fall-through
    if (this._stage=="search") {
      if ( (probe=this.genSeqn())===false ) {
        alert ("Lookup complete, found "+this._ships.length+" ships");
        this._stage="finished";
        return(false);
      }
      return (probe);      
    }
  }// end move
  
  this.reflect=function(res) {
    if ( res=="k" ) {
      this._stage="kill";
      this.harvest();
      this._stage="search";
      return;
    }
    if (this._stage=="search" && res) {
      this._hits.push(this._probe);
      this.initGenNear();
      this._stage="near";
      return;
    }
    if (this._stage=="near" && res) {
      this._hits.push(this._probe);
      this.initGenStraight();
      this._stage="straight";
      return;
    }    
    if (this._stage=="straight" && (res===true || res=="h") ) {
      if (this._dir=="high") this._hits.push(this._probe);
      else this._hits.unshift(this._probe);
      //alert ("L:"+this._hits.length);
      return;
    }
    if (this._stage=="straight" && (res===false || res=="m") ) {
      if (this._dir=="high") this._highStop=1;
      else this._lowStop=1;
      //alert("3 lowstop:"+this._lowStop+" highstop:"+this._highStop);
      if ( this._lowStop && this._highStop ) {
        this._stage="kill";
        this.harvest();
        this._stage="search";   
      }      
      return;
    }    
  }// end reflect
  
  this.harvest=function(){
    //alert ("kill at "+this._probe[0]+this._probe[1]+", "+this._hits.length+"squares");
    this._ships.push(this._hits);
    this._hits=[];
    this._nearHits=[];
    this._dir="";
    this._lowStop=0;
    this._highStop=0;
    //this._stage="search";
  }

  this.reset=function() {
    this._stage="search";
    //this.source=new Seq2d();// duplicate from constructor
    this.source=new Rand2d();//(1,[0,9]); DEBUGS
    this._hits=[];
    this._nearHits=[];
    this._ships=[];
    this._probe=[];
    this._count=0;    
  }  
  
  this.search=function() {
    var r,probe;
    this.reset();
    while ( probe=this.move() ) {
      //alert(">"+probe[0]+probe[1]);
      r=this._b.checkHit( probe[0],probe[1] );
      if (r) { 
        this._b.put( "h",probe[0],probe[1] );
        v.pb.put( probe[0],probe[1],"h" );// DEBUG
      }
      else {
        this._b.put( "m",probe[0],probe[1] );
        v.pb.put( probe[0],probe[1],"m" );// DEBUG      
      }
      this.reflect(r);
    }
    //alert(">"+probe);
  }
  
  this.yield=function() {
    return(this._ships);
  }

}  