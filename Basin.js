"use strict;"

function Basin(mode) {
  this._isPublic=(mode==="public");
  this._fill = this._isPublic ? "u" : "e";
  
  this._arr=new Array(DIM);
  for (var i = 0; i < DIM; i++) {
    this._arr[i] = new Array(DIM);
  }  

  for (i=0;i<DIM;i++) {
    for (var j=0;j<DIM;j++) {
      this._arr[i][j]=this._fill;
    }
  }
  
  this.get=function(row,col) {
    if( row instanceof Array ) {
      var col=row[1];
      var row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);    
    return ( this._arr[row][col] );
  }
  
  this.put=function(val,row,col) {
    if( row instanceof Array ) {
      var col=row[1];
      var row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);    
    this._arr[row][col]=val;
  }
  
  this.checkStrikable=function(row,col) {
    if( row===false ) return(false);// continue to the outside check
    if( row instanceof Array ) {
      //alert("array!");
      var col=row[1];
      var row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);
    var val=this._arr[row][col];
    return ( val=="u" || val=="s" || val=="e" );
  }
  
  this.checkHit=function(row,col) {
    if( row instanceof Array ) {
      var col=row[1];
      var row=row[0];
    }
    if( row<0 || row>=DIM || col<0 || col>=DIM ) return(false);    
    var val=this._arr[row][col];
    return ( val=="s" );
  } 
      
  /* 
   * Finds all neighbouring points available for a strike
   * @param Int row
   * @param Int col
   * @param String mode "all" for orthogonal and diagonal neighbours, "cross" for only othogonal
   * @uses arrayUtils::adjAll
   * @uses arrayUtils::adjCross
   * @returns Array
   */
  this.adjStrikable=function(row,col,mode) {
    var adjacent=[];
    if ( mode=="all" ) adjacent=adjAll(row,col);
    else if ( mode=="cross" ) adjacent=adjCross(row,col);
    else throw ("adjStrikable:invalid mode");
    //alert ("got "+myAdjAll.length+" valid neighbours in "+mode+" mode");
    var res=[];
    for (var i=0;i<adjacent.length;i++) {
      if ( this.checkStrikable(adjacent[i]) ) res.push( adjacent[i] );
    }
    return(res);
  }
  
  this.checkSunk=function(ship) {
    var rc=[];
    for (var i=0;i<ship.length;i++){
      rc=ship[i];
      if( this.get(rc[0],rc[1]) !== 'h') {
        //alert ( "Checked -- alive "+this.get(rc[0],rc[1]) );
        return false;
      } 
    }
    return true;
  }
  
  this.markSunk=function(ship) {
    var rc=[];
    for (var i=0;i<ship.length;i++) {
      rc=ship[i];
      this.put('w',rc[0],rc[1]);
    }    
  }
  
  /*this.collectAround=function(ship) {
    return ( around(ship) );
  }*/
  
  this.markAround=function(ship) {
    var rc,c;
    var ar=around(ship);
    for (var j=0;j<ar.length;j++) {
      rc=ar[j];
      c=this.get(rc[0],rc[1]);
      if ( c=="u" || c=="e" ) {
        this.put("c",rc[0],rc[1]);
      }
    }    
  }
  
  this.markShip=function(ship) {
    var rc=[];
    for (var i=0;i<ship.length;i++){
      rc=ship[i];
      this.put('s',rc[0],rc[1]);
    }      
  }
  
  this.cleanUp=function() {
    if(this._isPublic) alert("Only cleanUp() of private Basins is supported");
    var range=new Seq2d();
    var rc; 
    var c,cc;
    while ( rc=range.go() ) {
      c=this.get(rc[0],rc[1]);
      if(c=="h" || c=="w") cc="s";
      else cc="e";
      this.put(cc,rc[0],rc[1]);
    }
  }
  
  this.clear=function() {
    for (var i=0;i<DIM;i++) {
      for (var j=0;j<DIM;j++) {
        this._arr[i][j]=this._fill;
      }
    }    
  }
  
  this.takeShips=function(ships) {
    if ( !(ships instanceof Array) || !(ships[0] instanceof Array)) throw ("Basin::takeShips: invalid argument "+ships);
    for (var i=0;i<ships.length;i++) {
      this.markShip(ships[i]);
    }
  }
  
}// end Basin