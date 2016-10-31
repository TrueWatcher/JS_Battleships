"use strict";

function Harvester(basin) {
  this._b=basin;
  this._stage="search";// search oneHit direction kill finish
  this.source=new Seq2d();
  this._hits=[];
  this._nearHits=[];
  this._ships=[];
  //this._nearHitsDetected=false;
  this._dir="";
  this._row=-1;
  this._col=-1;
  this._lowStop=0;
  this._highStop=0;
  
  this.step=function () {
    var probe=[];
    if (this._stage=="search") {
      
      while( !this._b.checkStrikable( probe=this.source.go() ) ) {
        if( probe===false ) {
          this._stage="finished";
          return(false);
        }
      }
      //alert("+"+probe[0]+probe[1]+":"+this._b.get(probe) );
      if( this._b.checkHit( probe ) ) {
        this._stage="oneHit";
        this._hits.push(probe);
        this._b.put("h",probe);
        v.pb.put(probe[0],probe[1],"h");
        this._nearHits=this._b.adjAllStrikable( probe[0],probe[1] );
        alert("hit with "+this._nearHits.length+" nearHits");
        /*if ( this._nearHits.length ) this._nearHitsDetected=true;
        else {// cornered single-square ship
          this._stage="kill";

        }*/
      }
      else {
        this._b.put("m",probe);
        v.pb.put(probe[0],probe[1],"m");
        
      }
    }
    if (this._stage=="oneHit" /*&& this._nearHitsDetected*/ ) {
      if ( this._nearHits.length===0 ) {
        this._stage="kill";// single-square
      }
      else {
        probe=this._nearHits.pop();
        if( this._b.checkHit( probe ) ) {
          this._hits.push(probe);
          this._b.put("h",probe);
          v.pb.put(probe[0],probe[1],"h");
          this._stage="twoHits"
        }
        else {
          this._b.put("m",probe);
          v.pb.put(probe[0],probe[1],"m");
        };
      }
    }
    if (this._stage=="twoHits") {
      var h0=this._hits[0];
      var h1=this._hits[1];
      if( h0[0]===h1[0] ) {
        this._dir="row";
        this._row=h0[0];
      }
      if( h0[1]===h1[1] ) {
        this._dir="col";
        this._col=h0[1];
      }
      if( h0[0]===h1[0] && h0[1]===h1[1]) alert("Error! duplicate hits");
      if( h0[0]!==h1[0] && h0[1]!==h1[1]) alert("Error! unadjacent hits");      
      alert("ship :"+this._dir);
      this._stage="direction";
    }
    if (this._stage=="direction") {
      if (this._dir=="row") {
        var cols=[];
        for (var k=0;k<this._hits.length;k++) {
          var h=this._hits[k];
          cols.push(h[1]);
        }
        var minCol=Math.min.apply(null, cols);
        var maxCol=Math.max.apply(null, cols);
        if (minCol==0) this._lowStop=1;
        if (maxCol==DIM-1) this._highStop=1;
        
 
        if ( !this._lowStop ) {
          probe=[ this._row,(minCol-1) ];
          if( this._b.checkHit( probe ) ) {
            this._hits.push(probe);
            this._b.put("h",probe);
            v.pb.put(probe[0],probe[1],"h");
          }
          else {
            this._b.put("m",probe);
            v.pb.put(probe[0],probe[1],"m");
            this._lowStop=1;      
          }     
        }
        if ( !this._highStop ) {
          probe=[ this._row,(maxCol+1) ];
          if( this._b.checkHit( probe ) ) {
            this._hits.push(probe);
            this._b.put("h",probe);
            v.pb.put(probe[0],probe[1],"h");
          }
          else {
            this._b.put("m",probe);
            v.pb.put(probe[0],probe[1],"m");
            this._highStop=1;
            this._stage="kill";
          }     
        }
        if (this._highStop && this._lowStop) this._stage="kill";
       
      }// end if row  
        
      if (this._dir=="col") {
        var rows=[];
        for (var k=0;k<this._hits.length;k++) {
          var h=this._hits[k];
          rows.push(h[0]);
        }
        var minRow=Math.min.apply(null, rows);
        var maxRow=Math.max.apply(null, rows);
        if (minRow==0) this._lowStop=1;
        if (maxRow==DIM-1) this._highStop=1;
        
 
        if ( !this._lowStop ) {
          probe=[ (minRow-1),this._col ];
          if( this._b.checkHit( probe ) ) {
            this._hits.push(probe);
            this._b.put("h",probe);
            v.pb.put(probe[0],probe[1],"h");
          }
          else {
            this._b.put("m",probe);
            v.pb.put(probe[0],probe[1],"m");
            this._lowStop=1;      
          }     
        }
        if ( !this._highStop ) {
          probe=[ (maxRow+1),this._col ];
          if( this._b.checkHit( probe ) ) {
            this._hits.push(probe);
            this._b.put("h",probe);
            v.pb.put(probe[0],probe[1],"h");
          }
          else {
            this._b.put("m",probe);
            v.pb.put(probe[0],probe[1],"m");
            this._highStop=1;
            this._stage="kill";
          }     
        }        
      }// end if col      
 
    }// end if direction
    if (this._stage=="kill") {
      alert ("kill at "+probe[0]+probe[1]+", "+this._hits.length+"squares");
      this._ships.push(this._hits);
      this._hits=[];
      this._nearHits=[];
      this._dir="";
      this._lowStop=0;
      this._highStop=0;
      this._stage="search";      
    }
    return(true);
  }

}