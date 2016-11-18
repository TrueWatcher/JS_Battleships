"use strict";
/**
 * A strategy to play Battleship game.
 * Has 3 sub-strategies: 1) random strikes until an enemy ship is engaged 2) strikes around the first hit until second hit 3) following the line of two hits
 * Can be used also to generate ships array from user's drawing on his board, for this purpose it can detect "kill" outcome and collect ships data
 * @constructor
 * @param {object Basin} basin A game field
 * @param string mode "search" to gather ships, "fight" to actually play game. Seems to be futile in current version.
 * Searching:
 * @method search
 * @method yield
 * Fighting:
 * @method move
 * @method reflect
 */
function Harvester(basin,mode) {
  //this._mode=mode;// search fight
  //this._b=basin;
  var _stage="search";// search oneHit direction kill finish
  //this.source=new Seq2d();
  var _source=new Rand2d();
  var _hits=[];
  var _nearHits=[];
  var _ships=[];
  var _dir="";
  var _row=-1;
  var _col=-1;
  var _fix;
  var _mov;
  var _lowStop=0;
  var _highStop=0;
  var _probe=[];
  var _count=0;

  /**
   * Generates a probe in a "random" mode.
   * @return {array|boolean} false if generator fails or if there was too many cycles
   * @private
   */
  function genSeqn() {
    var probe;
    while( !basin.checkStrikable( probe=_source.go() ) ) {
      _count++;
      if ( probe===false || _count>=(DIM*DIM+1) ) return(false);
    }
    _probe=probe;
    return (probe);
  }

  /**
   * Initializes "near" mode by filling a list of potential second-hits.
   * @see Basin::adjStrikable
   * @return void
   * @private
   */
  function initGenNear() {
    var h0=_hits[0];
    _nearHits=basin.adjStrikable( h0[0],h0[1],"cross" );
  }

  /**
   * Generates a probe in a "near" mode by iterating near-hit list
   * @return array.
   * @private
   */
  function genNear() {
    var probe;
    if (_nearHits.length==0) return (false);
    probe=_nearHits.pop();
    _probe=probe;
    return(probe);
  }

  /**
   * Inits 'straight' mode by processing two adjacent hits.
   * @return void
   * @private
   */
  function initGenStraight() {
      var h0=_hits[0];
      var h1=_hits[1];
      if( h0[0]===h1[0] ) {
        _fix=0;
        _mov=1;
        _row=h0[0];
      }
      if( h0[1]===h1[1] ) {
        _fix=1;
        _mov=0;
        _col=h0[1];
      }
      if( h0[0]==h1[0] && h0[1]==h1[1]) throw new Error("Harvester::initGenStraight: duplicate hits");
      if( h0[0]!==h1[0] && h0[1]!==h1[1]) throw new Error("Harvester::initGenStraight: unadjacent hits");
      if ( h1[_mov] < h0[_mov] ) arraySwap01(_hits); // hits are packed in ascending order
      //alert ( "from "+_hits[0].join()+" to "+_hits[1].join() );
      _lowStop=false;
      _highStop=false;
  }

  /**
   * Generates probe in "straight" mode. Tries both directions ("low" and "high").
   * @return {array|boolean} false if met empty square or border on both ends
   * @private
   */
  function genStraight() {
    var probe;
    var nextLow,nextHigh;

    var l=_hits.length;
    //alert("L:"+l+" 1 lowstop:"+_lowStop+" highstop:"+_highStop);

    if(_mov){ // mov=1=col fix=0=row
      nextLow=[ _row,(_hits[0][_mov]-1) ];
      nextHigh=[ _row,(_hits[l-1][_mov]+1) ];
    }
    else { // mov=0=row fix=1=col
      nextLow=[ (_hits[0][_mov]-1),_col ];
      nextHigh=[ (_hits[l-1][_mov]+1),_col ];
    }

    if ( _hits[0][_mov]<=0 || !basin.checkStrikable(nextLow) ) _lowStop=1;

    if ( _hits[l-1][_mov] >= (DIM-1) || !basin.checkStrikable(nextHigh) ) _highStop=1;
    //alert("2 lowstop:"+_lowStop+" highstop:"+_highStop);
    if ( _lowStop && _highStop ) return false;

    if ( !_lowStop ) {
      probe=nextLow;
      _dir="low";
    }
    else {
      probe=nextHigh;
      _dir="high";
    }
    //alert("Going "+_dir);
    _probe=probe;
    return probe;
  }

  /**
   * Generates next move and manages possible state changes.
   * @return {array|boolean} false if work is finished
   */
  this.move=function() {
    var probe;
    //alert("move");
    if (_stage=="straight") {
      if ( (probe=genStraight())===false ) {
        _stage="kill";
      }
      else return(probe);
    }
    // fall-through
    if (_stage=="near") {
      if ( (probe=genNear())===false ) {
        _stage="kill";
      }
      else return(probe);
    }
    // fall-through
    if (_stage=="kill") {
      harvest();
      _stage="search";
    }
    // fall-through
    if (_stage=="search") {
      if ( (probe=genSeqn())===false ) {
        //alert ("Lookup complete, found "+_ships.length+" ships");
        _stage="finished";
        return(false);
      }
      return (probe);
    }
  }// end move

  /**
   * Accounts for reply accordingly to the current stage, manages state changes.
   * @param char res A reply (w,h,m,f,true=h,false=m)
   * @return void
   */
  this.reflect=function(res) {
    if ( res=="n" ) throw new Error("Harvester::reflect: Am I crazy and repeating myself?");
    if ( res=="w" ) {
      _stage="kill";
      harvest();
      _stage="search";
      return;
    }
    if ( _stage=="search" && (res===true || res==="h" || res==="w" || res==="f") ) {
      _hits.push(_probe);
      initGenNear();
      _stage="near";
      return;
    }
    if ( _stage=="near" && (res===true || res==="h" || res==="w" || res==="f") ) {
      _hits.push(_probe);
      initGenStraight();
      _stage="straight";
      return;
    }
    if ( _stage=="straight" && (res===true || res=="h" || res==="w" || res==="f") ) {
      if (_dir=="high") _hits.push(_probe);
      else _hits.unshift(_probe);// hits are packed in ascending order
      //alert ("L:"+_hits.length);
      return;
    }
    if ( _stage=="straight" && (res===false || res=="m") ) {
      if (_dir=="high") _highStop=1;
      else _lowStop=1;
      //alert("3 lowstop:"+_lowStop+" highstop:"+_highStop);
      if ( _lowStop && _highStop ) {
        _stage="kill";
        harvest();
        _stage="search";
      }
      return;
    }
  };// end reflect

  /**
   * Accounts for a kill.
   * @return void
   * @private
   */
  function harvest() {
    //alert ("kill at "+_probe[0]+_probe[1]+", "+_hits.length+"squares");
    _ships.push(_hits);
    _hits=[];
    _nearHits=[];
    _dir="";
    _lowStop=0;
    _highStop=0;
  }

  this.reset=function() {
    _stage="search";
    //_source=new Seq2d();// duplicate from constructor
    _source=new Rand2d();//(1,[0,9]); DEBUG
    _hits=[];
    _nearHits=[];
    _ships=[];
    _probe=[];
    _count=0;
  };

  /**
   * Performs full working cycle of searching for ships across the game field.
   * @return void
   */
  this.search=function() {
    var r,probe;
    this.reset();
    while ( probe=this.move() ) {
      //alert(">"+probe[0]+probe[1]);
      r=basin.checkHit( probe );
      if (r) {
        basin.put( "h",probe );
        //v.pb.put( "h",probe );// DEBUG
      }
      else {
        basin.put( "m",probe );
        //v.pb.put( "m",probe );// DEBUG
      }
      this.reflect(r);
    }
    //alert(">"+probe);
  };

  /**
   * Exports the catch.
   * @return array
   */
  this.yield=function() {
    return(_ships);
  };

}