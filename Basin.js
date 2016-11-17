"use strict;"

/**
 * Part of Model that represents the game field
 * "u":unknown,"e":empty,"s":ship,"m":miss,"h":hit,"w":wreck,"c":buoy
 * @constructor
 * @param string mode public for tracking board (no ships, only strikes) or private for primary board
 */
function Basin(mode) {
  this._isPublic=(mode==="public");
  this._fill = this._isPublic ? "u" : "e";

  this._arr=new Array(DIM);
  for (var i = 0; i < DIM; i++) {
    this._arr[i] = createArray(DIM, this._fill);
  }

  this.get=function(row,col) {
    if( row instanceof Array ) {
      var col=row[1];
      var row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);
    return ( this._arr[row][col] );
  };

  this.put=function(val,row,col) {
    if( row instanceof Array ) {
      var col=row[1];
      var row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);
    this._arr[row][col]=val;
  };

  this.clear=function() {
    var range=new Seq2d();
    var rc;
    while ( rc=range.go() ) {
      this.put(this._fill,rc)
    }
  };

  /**
   * Takes a point [row,col] and tells if it is available for a strike
   * @param integer|array row row or point [row,col]
   * @param integer col
   * @returns boolean
   */
  this.checkStrikable=function(row,col) {
    var val;
    if( row===false ) return(false);// continue to the outside check
    if( row instanceof Array ) {
      //alert("array!");
      col=row[1];
      row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);
    val=this._arr[row][col];
    return ( val=="u" || val=="s" || val=="e" );
  };


  this.checkHit=function(row,col) {
    var val;
    if( row instanceof Array ) {
      var col=row[1];
      var row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);
    val=this._arr[row][col];
    return ( val=="s" );
  };

  /**
   * Takes a point [row,col] and finds all neighbouring points available for a strike
   * @param integer|array row row or pair [row,col]
   * @param integer col
   * @param string mode "all" for orthogonal and diagonal neighbours, "cross" for only othogonal
   * @uses arrayUtils::adjAll
   * @uses arrayUtils::adjCross
   * @returns Array
   */
  this.adjStrikable=function(row,col,mode) {
    var i, adjacent=[], res=[];
    if( row instanceof Array ) {
      col=row[1];
      row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);
    if ( mode=="all" ) adjacent=adjAll(row,col);
    else if ( mode=="cross" ) adjacent=adjCross(row,col);
    else throw ("Basin::adjStrikable: invalid mode");
    //alert ("got "+myAdjAll.length+" valid neighbours in "+mode+" mode");
    for (var i=0;i<adjacent.length;i++) {
      if ( this.checkStrikable(adjacent[i]) ) res.push( adjacent[i] );
    }
    return(res);
  };

  /**
   * Checks if the given ship is all-dead
   * @param array ship
   * @return boolean
   */
  this.checkSunk=function(ship) {
    var i,rc=[];
    for (i=0;i<ship.length;i++){
      rc=ship[i];
      if( this.get(rc) !== 'h') {
        //alert ( "Checked -- alive "+this.get(rc[0],rc[1]) );
        return false;
      }
    }
    return true;
  };

  this.markSunk=function(ship) {
    var rc=[];
    for (var i=0;i<ship.length;i++) {
      rc=ship[i];
      this.put('w',rc);
    }
  };

  /*this.collectAround=function(ship) {
    return ( around(ship) );
  }*/

  this.markAround=function(ship) {
    var rc,c;
    var ar=around(ship);
    for (var j=0;j<ar.length;j++) {
      rc=ar[j];
      c=this.get(rc);
      if ( c=="u" || c=="e" ) {
        this.put("c",rc);
      }
    }
  };

  this.markShip=function(ship) {
    var rc;
    for (var i=0;i<ship.length;i++){
      rc=ship[i];
      this.put('s',rc);
    }
  };

  this.cleanUp=function() {
    if(this._isPublic) throw("Basin::cleanUp: only private Basin is supported");
    var range=new Seq2d();
    var rc;
    var c,cc;
    while ( rc=range.go() ) {
      c=this.get(rc);
      if(c=="h" || c=="w") cc="s";
      else cc="e";
      this.put(cc,rc);
    }
  };

  this.takeShips=function(ships) {
    var i;
    if ( !(ships instanceof Array) || !(ships[0] instanceof Array)) throw ("Basin::takeShips: invalid argument "+ships);
    for (var i=0;i<ships.length;i++) {
      this.markShip(ships[i]);
    }
  };

}// end Basin