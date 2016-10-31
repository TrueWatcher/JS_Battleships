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
  
  this.adjAll=function(row,col) {
    return( adjAll(row,col) );
  }
    
  this.adjAllStrikable=function(row,col) {
    var myAdjAll=adjAll(row,col);
    //alert ("got "+myAdjAll.length+" valid neighbours");
    var res=[];
    for (var i=0;i<myAdjAll.length;i++) {
      if ( this.checkStrikable(myAdjAll[i]) ) res.push( myAdjAll[i] );
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
  
  this.markAround=function(ship,board) {
    var rc,c;
    var ar=around(ship);
    for (var j=0;j<ar.length;j++) {
      rc=ar[j];
      c=this.get(rc[0],rc[1]);
      if ( c=="u" || c=="e" ) {
        this.put("c",rc[0],rc[1]);
        //if (board) board.put(rc[0],rc[1],"c");
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
  
}