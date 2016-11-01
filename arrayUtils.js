// http://stackoverflow.com/questions/143847/best-way-to-find-if-an-item-is-in-a-javascript-array
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (obj, fromIndex) {
    if (fromIndex == null) {
      fromIndex = 0;
      } else if (fromIndex < 0) {
         fromIndex = Math.max(0, this.length + fromIndex);
      }
      for (var i = fromIndex, j = this.length; i < j; i++) {
        if (this[i] === obj) return i;
      }
      return -1;
  };
}

Array.prototype.indexOfVect = function (obj, fromIndex) {
  if ( !(obj instanceof Array) ) {
    alert("Usage error, non-array argument for indexOfVect");
    return -1;
  }    
  if (fromIndex == null) {
    fromIndex = 0;
  } else if (fromIndex < 0) {
    fromIndex = Math.max(0, this.length + fromIndex);
  }
  for (var i = fromIndex, j = this.length; i < j; i++) {
    if (this[i].join() === obj.join()) return i;
  }
  return -1;
};

// http://stackoverflow.com/questions/9907419/javascript-object-get-key-by-value
Object.prototype.getKeyByValue = function( value ) {
  for( var prop in this ) {
    if( this.hasOwnProperty( prop ) ) {
       if( this[ prop ] === value ) return prop;
    }
  }
}

// http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
function arrayShuffle(a) {
  var j, x, i;
  for (i = a.length; i; i--) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }
}

function adjAll(row,col,max) {
  if (!max) var max=DIM;
  var res=[];
  var r,c;
  for (var i=0;i<=2;i++) {
    for (var j=0;j<=2;j++) {
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

function adjCross(row,col,max) {
  if (!max) var max=DIM;
  var try4=[ [row-1,col],[row,col-1],[row+1,col],[row,col+1] ];
  var rc;
  var res=[]
  for (var i=0;i<4;i++) {
    rc=try4[i];
    if( rc[0]>=0 && rc[0]<max && rc[1]>=0 && rc[1]<max ) res.push(rc);
  }
  return(res);
}

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
  //alert(res.length);
  return(res);
}

function Rand2d(cheatI,cheatVal) {
  this._arr=[];
  for (var i=0;i<DIM;i++) {
    for (var j=0;j<DIM;j++) {
      this._arr.push( [i,j] );
    }
  }
  arrayShuffle(this._arr);
  this._i=0;
  
  this.go=function() {
    if(this._i==cheatI) {
      this._i++;
      return(cheatVal);// DEBUG
    }  
    var r=this._arr[this._i];
    this._i++;
    if (this._i>=this._arr.length) {
      arrayShuffle(this._arr);
      this._i=0;
    }
    return (r);
  }
}


function Seq2d() {
  this.r=0;
  this.c=0;
  
  this.go=function(){
    if (this.r>=DIM) {
      this.r=0;
      this.c=0;
      return(false);
    }
    var rc=[ this.r,this.c ];
    this.c++;
    if(this.c>=DIM) {
      this.c=0;
      this.r++;
    }
    return(rc);
  }
}

/*function rand2d() {
  rc=[ Math.floor(Math.random()*DIM), Math.floor(Math.random()*DIM) ];
  return(rc);
}*/

function createArray(size,value) {
  var s=size;
  var arr=[];
  while (s--) arr.push(value);
  //alert ("l "+arr.length);
  return(arr);
}
    
function arraySwap01(arr) {
  var a=arr[0];
  arr[0]=arr[1];
  arr[1]=a;
}


function putToElement(str,id) {
  var e;
  if ( id.nodeName ) e=id;
  else if ( typeof id =="string" ) e=document.getElementById(id);
  else throw ("putToElement: invalid argument "+id);  
  //var e=document.getElementById(id);
  e.innerHTML=str;    
}

function toggleElement(id) {
  var e;
  if ( id.nodeName ) e=id;
  else if ( typeof id =="string" ) e=document.getElementById(id);
  else throw ("toggleElement: invalid argument "+id);
  var d=e.style.display;
  if (d=="none") e.style.display="";
  else e.style.display="none";
}