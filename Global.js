"use strict";


/**
 * Contains game-wide settings and their accessor/import/export methods.
 * Some of settings are normal variables, some contain objects. None contains JSON (differs from similar server-side class).
 * @constructor
 */
function Global() {     
  this.online="online";
  var _stage="zero";
  var _stagesAllowed=["zero", "intro", "rules", "ships", "fight", "finish","aborted"];
  var _statesAllowed=["zero", "intro", "connecting", "picking", "converged", "confirming",  "ships", "confirmingShips", "fight", "cycling", "cyclingReq", "cyclingOk", "leaving", "aborted", "finish"];
  var _state="zero";
  this.dealId=0;
  this.pSide="";// A or B
  this.pName="";
  this.eSide="";// A or B
  this.eName="";
  this.namesAB={};// {A:White,B:Black}
  this.picks={};
  this.defaultPicks={"firstMove":0,"forces":0,"strikeRule":0,"level":0};
  var _total=0;
  this.hideInactivePanels=false;
  
  var _activeAB="A";// A or B
  this._firstActiveAB="A";
  var _winner;
  this.forces1=[0,4,3,2,1,0,0,0,0,0,0];// public, used by RulesForm
  this.forces2=[0,0,1,1,1,1,0,0,0,0,0];// public, used by RulesForm
  var _forces=this.forces1;
  var _strikes1="oe";
  var _strikes2="bs";
  this._strikeRule=_strikes1;
  var _level=0;// 0 full, 1 easy, 2 cheat
  this._demandEqualForces=1;
  this._previewEnemyShips=0;//0;//1;
  this._enemyStriker="harvester";// "random";
  this._theme="ascii";  
  
  this.otherSide=function(side) {
    if (side=="A") return ("B");
    if (side=="B") return ("A");
    throw new Error("otherSide: wrong argument:"+side+"!");
  }
  
  this.setStage=function(stage) {
    if (_stagesAllowed.indexOf(stage)<0 ) throw new Error("Global::setStage: invalid value "+stage);
    _stage=stage;
    return(_stage);
  };

  this.getStage=function() { return(_stage); };
  
  this.setState=function(state) {
    if (_statesAllowed.indexOf(state)<0 ) throw new Error("Global::setState: invalid value "+state);
    _state=state;
    return(state);
  };

  this.getState=function() { return(_state); };
  
  this.setNames=function(pn,en) {
    if (!pn || !en || pn==en) throw new Error("Global::setNames: empty or equal argument(s)");
    this.pName=pn;
    this.eName=en;
  };
  
  this.getName=function(side) {
    if ( side == this.pSide ) return this.pName;
    if ( side == this.eSide ) return this.eName;
    throw new Error ("getName: unknown side:"+side+"!");
  };
  
  this.clearNames=function() {
    this.pName=this.eName="";
    this.names={};    
  };
  
  this.getForces=function() { return(_forces); };
  
  this.getActive=function() { return (_activeAB); };
  
  this.setActive=function(ab) {
    if (ab != "A" && ab != "B") throw new Error ("Invalid new active side:"+ab+"!");
    //alert("Global : active set to "+ab);
    _activeAB=ab;
  };
  
  this.isActive=function(ab) {
    if (ab != "A" && ab != "B") throw new Error ("Invalid side:"+ab+"!");
    return (_activeAB == ab);
  };
  
  this.incTotal=function() { _total+=1; };
  
  this.getTotal=function() { return(_total); };
  
  this.setTotal=function(v) { _total=v; };
  
  this.setWinner=function(ab) {
    if (ab != "A" && ab != "B") throw new Error ("Invalid new active side:"+ab+"!");
    _winner=ab;    
  };
  
  this.getWinner=function() { return _winner; };
  
  /**
   * Deals with player-defined settings.
   * @param string picksStr A JSON representation of user form, given by View1::readPicks
   * @return void
   */
  this.setRules=function(picksStr) {
    //alert("setRules "+picksStr);
    var picks=JSON.parse(picksStr);
    var ck=compareKeys(this.defaultPicks,picks);
    if ( true !== ck ) throw new Error("setRules: "+ck);
    
    if ( picks.firstMove == 0 ) {
      this.setActive("A");
      this._firstActiveAB="A";      
    }
    else if ( picks.firstMove == 1 ) {
      this.setActive("B");
      this._firstActiveAB="B"; 
    }
    else throw new Error("setRules:invalid firstMove="+picks.firstMove);
    
    if ( picks.forces == 0 ) _forces=this.forces1;
    else if ( picks.forces === 1 ) _forces=this.forces2;
    else throw new Error("setRules:invalid forces="+picks.forces);
    
    if ( picks.strikeRule === 0 ) this._strikeRule=_strikes1;
    else if ( picks.strikeRule === 1 ) this._strikeRule=_strikes2;
    else throw new Error("setRules:invalid strikeRule="+picks.strikeRule);
    
    if ( picks.level === 0 ) _level=0;
    else if ( picks.level ===1 ) _level=1;
    else if ( picks.level ===2 ) _level=2;
    else throw new Error("setRules:invalid level="+picks.level);
    
    switch (_level) {
      case 2:
        this._demandEqualForces=0;
        this._previewEnemyShips=1;
        this._enemyStriker="harvester";
        break;
      case 1:
        this._enemyStriker="random";
        break;
      case 0:
    }
  };
  
  /**
   * Exports user-defined settings as JSON-encoded associative array.
   * @return string
   */
  this.exportRules=function() {
    var r={
      firstActiveAB:this._firstActiveAB, forces:_forces, strikeRule:this._strikeRule, demandEqualForces:this._demandEqualForces, previewEnemyShips:this._previewEnemyShips
    };
    r=JSON.stringify(r);
    //alert (r);
    return (r);
  };
  
  /**
   * Imports user-defined settings from associative array.
   * @param object r
   * @return void
   */  
  this.importRules=function(r) {
    //alert ("import rules");
    if ( !r || !(typeof r == "object") ) throw new Error ("Invalid argument "+r);
    this.setActive( r["firstActiveAB"] );
    _forces=r["forces"];
    this._strikeRule=r["strikeRule"];
    this._demandEqualForces=r["demandEqualForces"];
    this._previewEnemyShips=r["previewEnemyShips"];
  };
}