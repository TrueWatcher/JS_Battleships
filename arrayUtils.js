"use strict";

/**
 * Searches the array for the given value (primitive types).
 * @see http://stackoverflow.com/questions/143847/best-way-to-find-if-an-item-is-in-a-javascript-array
 * @param primitive obj needle
 * @param integer fromIndex initial offset
 * @return integer key | -1 if not found
 */
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (obj, fromIndex) {
    var i;
    if (fromIndex == null) {
      fromIndex = 0;
    }
    else if (fromIndex < 0) {
        fromIndex = Math.max(0, this.length + fromIndex);
    }
    for (i = fromIndex; i < this.length; i++) {
      if (this[i] === obj) return i;
    }
    return -1;
  };
}

/**
 * Searches the array for the given value (pairs and other arrays).
 * @param array obj needle
 * @param integer fromIndex initial offset
 * @return integer key | -1 if not found
 */
Array.prototype.indexOfVect = function (obj, fromIndex) {
  var i;
  if ( !(obj instanceof Array) ) {
    throw new Error("indexOfVect: non-array argument");
    return -1;
  }
  if (fromIndex == null) {
    fromIndex = 0;
  } else if (fromIndex < 0) {
    fromIndex = Math.max(0, this.length + fromIndex);
  }
  for (i = fromIndex; i < this.length; i++) {
    if (this[i].join() === obj.join()) return i;
  }
  return -1;
};

/**
 * Searches the assocArray for the given value.
 * @see http://stackoverflow.com/questions/9907419/javascript-object-get-key-by-value
 * @param mixed value
 * @return mixed key
 */
Object.prototype.getKeyByValue = function( value ) {
  for( var prop in this ) {
    if( this.hasOwnProperty( prop ) ) {
       if( this[ prop ] === value ) return prop;
    }
  }
}

/**
 * Shuffles the given array randomly in-place.
 * @see http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
 * @param array a
 * @return nothing
 */
function arrayShuffle(a) {
  var j, x, i;
  for (i = a.length; i; i--) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }
}

/**
 * Gives a list of all points neigbouring the given point [row,col] (and not outside the 0..max * 0..max square plane).
 * @param integer row
 * @param integer col
 * @param integer max
 * @return array of pairs [row,col]
 */
function adjAll(row,col,max) {
  if (!max) max=DIM;
  var res=[];
  var i,j;
  var r,c;
  for (i=0; i<=2; i++) {
    for (j=0; j<=2; j++) {
      if ( !(i==1 && j==1) ) {
        r=row+i-1;
        c=col+j-1;
        //alert ("try "+r+c);
        if( r>=0 && r<max && c>=0 && c<max ) {
          //alert ("got "+r+c);
          res.push( [r,c] );
        }
      }
    }
  }
  return (res);
}

/**
 * Gives a list of points, neigbouring the given point [row,col] except for diagonal neighbours (and not outside the 0..max * 0..max square plane).
 * @param integer row
 * @param integer col
 * @param integer max
 * @return array of pairs [row,col]
 */
function adjCross(row,col,max) {
  if (!max) max=DIM;
  var try4=[ [row-1,col],[row,col-1],[row+1,col],[row,col+1] ];
  var rc;
  var res=[]
  for (var i=0;i<4;i++) {
    rc=try4[i];
    if( rc[0]>=0 && rc[0]<max && rc[1]>=0 && rc[1]<max ) res.push(rc);
  }
  return(res);
}

/**
 * Takes an array of points [row,col] and gives list of neigbouring points.
 * @see adjAll()
 * @see adjCross()
 * @param array pointsArray array of pairs [row,col]
 * @param string mode "all" for all neighbours, "cross" for orthogonal only
 * @return array of pairs [row,col]
 */
function around(pointsArray,mode) {
  if ( !(pointsArray instanceof Array) /*|| !(pointsArray[0] instanceof Array)*/ ) {
    //alert ("Usage error! Non-array or single-dimension array passed to 'around()' ");
    return false;
  }
  var res=[];
  var adjacent=[];
  var rc,rca;
  for (var i=0;i<pointsArray.length;i++) {
    rc=pointsArray[i];
    if (mode=="cross") adjacent=adjCross(rc[0],rc[1]);
    else adjacent=adjAll(rc[0],rc[1]);
    for (var j=0;j<adjacent.length;j++) {
      rca=adjacent[j];
      if ( (pointsArray.indexOfVect(rca) <0) && (res.indexOfVect(rca) <0) ) res.push(rca);
    }
  }
  return(res);
}

/**
 * Generates random pairs [row,column], covering all plane 0..DIM * 0..DIM
 * Allows to insert one non-random pair into the output stream for debugging.
 *
 * @constructor
 * @see arrayShuffle()
 * @param integer cheatI position to insert
 * @param array cheatVal [row,column] additional pair
 *
 * @example
 * var rand=new Rand2d();
 * var probe1=rand.go();
 * var probe2=rand.go();
 */
function Rand2d(cheatI,cheatVal) {
  var _arr=[];// private property by closure
  for (var i=0;i<DIM;i++) {
    for (var j=0;j<DIM;j++) {
      _arr.push( [i,j] );
    }
  }
  arrayShuffle(_arr);
  var _i=0;// private property by closure

  /**
   * @return array [row,column]
   */
  this.go=function() {
    if(_i==cheatI) {
      _i++;
      return(cheatVal);// DEBUG
    }
    var r=_arr[_i];
    _i++;
    if ( _i >= _arr.length ) {
      arrayShuffle(_arr);
      _i=0;
    }
    return (r);
  };
}

/**
 * Generates pairs [row,column] : 0,0 0,1 .. 0,9 .. 1,0 1,1 .. 1,9 .. 9,9 false.
 * @constructor
 * @example
 * var range=new Seq2d();
 * while ( point=range.go() ) { ... }
 */
function Seq2d() {
  var _r=0, _c=0; // private properties by closure

  /**
   * @return array [row,column] | false on end
   */
  this.go=function(){
    var rc=[];
    if ( _r>=DIM ) {
      _r=0;
      _c=0;
      return(false);
    }
    rc=[ _r,_c ];
    _c++;
    if ( _c>=DIM ) {
      _c=0;
      _r++;
    }
    return(rc);
  };
}

/**
 * Returns pairs [row,column] from the given array, one pair by each call.
 * @constructor
 * @param array tape array of pairs [row,column]
 * @example
 * var testGen=new TapePlayer([ [0,0],[1,0],[1,1] ]);
 * while ( point=testGen.go() ) { alert(point); }
 */
function TapePlayer(tape) {
  if ( !(tape instanceof Array) ) throw new Error("ArrayUtils::TapePlayer: argument is not an array");
  if ( !(tape[0] instanceof Array) ) throw new Error("ArrayUtils::TapePlayer: argument is not an 2d-array");
  var _i=0; // private property by closure, also tape

  /**
   * @return array [row,column] | false on end
   */
  this.go=function() {
    if ( _i>=tape.length ) return(false);
    else {
      var ret=tape[_i];
      //alert( "Naxt : "+ret.join() );
      _i++;
      return ( ret );
    }
  };

  /**
   * @return integer current offset
   */
  this.getIndex=function() {
    return(_i);
  };
}

/**
 * Returns array elements one by one, then false.
 * @constructor
 * @return mixed
 */
function ArrayIterator(arr) {
  if (!(arr instanceof Array)) throw new Error ("Non-array argument "+(typeof arr));
  var _i=0, l=arr.length, _r=[];
  
  this.go=function(){
    if ( _i >= l ) return false;
    _r=arr[_i];
    _i+=1;
    return _r;
  }
  
  this.getLatest=function() { return _r; };
  this.getIndex=function() { return _i; };
}

/**
 * Creates an array of the given length and fills it with the given value.
 * @param integer size
 * @param mixed value
 * @return array
 * @example
 * createArray(3,0) // [ 0, 0, 0 ]
 */
function createArray(size,value) {
  var s=size;
  var arr=[];
  while (s--) arr.push(value);
  //alert ("l "+arr.length);
  return (arr);
}

/**
 * Swaps 0th and 1st elements of the given array in-place.
 * @param array arr
 * @return nothing
 */
function arraySwap01(arr) {
  var a=arr[0];
  arr[0]=arr[1];
  arr[1]=a;
}

/**
 * Tests if argument is an array.
 * @return boolean
 */
function isArray(x) { return (x instanceof Array) };

/**
 * Compares associative arrays.
 * @param object o1
 * @param object o2
 * @param boolean valsNotEmpty=true demands similar keys and non-empty values
 * @param boolean valsEqual=false demands similar keys and values ( by == )
 * @return string|boolean true on success, error message on failure
 */
function compareKeys(o1,o2,valsNotEmpty,valsEqual) {
  var k,v,j;
  if ( typeof valsNotEmpty==undefined ) valsNotEmpty=true;
  if ( typeof valsEqual==undefined ) valsEqual=false;
  for (k in o1) {
    if ( o1.hasOwnProperty(k) ) {
      if ( ! o2.hasOwnProperty(k) ) return ("Key in o1, not in o2 :"+k);
      if ( valsNotEmpty && ( !o1[k] || !o2[k] ) ) return ("Values for "+k+":"+o1[k]+"/"+o2[k]+"!");
      if ( valsEqual && o1[k] != o2[k] ) return ("Values for "+k+":"+o1[k]+"/"+o2[k]+"!");
    }
  }
  for (j in o2) {
    if ( o2.hasOwnProperty(j) ) {
      if ( ! o1.hasOwnProperty(j) ) return ("Key in o2, not in o1 :"+j);
    }
  }
  return true;
}