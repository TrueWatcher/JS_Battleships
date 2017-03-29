<?php
/**
 * Contains game parameters and proceedings, their accessor methods and batch export/import methods.
 * Some fields are themselves JSON-encoded arrays.
 */
class Game {

  protected $id=null;
  public static $sides=["A","B"];
  protected $players=["A"=>"","B"=>""];
  public $timeInit=0;
  public $timeConnected=0;
  public $timeFinished=0;
  public $agendaFile="agenda.json";
  protected $stages=["zero","intro","rules","ships","fight","finish","aborted"];
  protected $states=["zero","connecting","picking","converged","confirming","ships","confirmingShips","fight","finish","cyclingReq","cyclingOk","leaving","aborted"];
  protected $stage="zero";
  protected $state="zero";
  protected $activeSide="";
  protected $picks=["A"=>"{}","B"=>"{}"];// array of JSONs
  protected $defaultPicks='{"firstMove":0,"forces":0,"strikeRule":0,"level":0}';
  public $rulesSet="{}";// JSON
  protected $ships=["A"=>"[]","B"=>"[]"];// array of JSONs
  protected $moves="[]";// JSON
  protected $stats='{}';// JSON
  protected $defaultStats='{"strikes":0,"hits":0,"afloat":0,"largest":0}';// JSON
  protected $clip=0;
  protected $total=0;
  public $winner="";
  
  function __construct() {
    $this->picks["A"] = $this->picks["B"] = $this->defaultPicks;
    $this->stats = '{"A":'.$this->defaultStats.',"B":'.$this->defaultStats.'}';
  }
  
  function setTimeInit() { $this->timeInit=time(); }
  
  function setTimeConnected() { $this->timeConnected=time(); }
  
  function setTimeFinished() { $this->timeFinished=time(); }
  
  function getId() { return($this->id); }

  function setStage($newStage) {
    if (! in_array($newStage,$this->stages) ) throw new Exception("Invalid target stage:".$newStage."!");
    $this->stage = $newStage;
  }
  
  function getStage() { return($this->stage); }
  
  function setState($newState) {
    if (! in_array($newState,$this->states) ) throw new Exception("Invalid target state:".$newState."!");
    $this->state = $newState;
    return($newState);
  }
  
  function getState() { return($this->state); }
  
  function getPick($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    return ( $this->picks[$side] );    
  }

  function setPick($side,$json) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $this->picks[$side] = $json;    
  }
  
  function getName($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    return ( $this->players[$side] );    
  }

  function setName($side,$name) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $this->players[$side] = $name;    
  }
  
  function getStats() {
    $s=json_decode($this->stats,true);
    if (!is_array($s)) throw new Exception ("Failed to decode ststistics from ".$this->stats);
    return $s;
  }
  
  function setStats($statArr) {
    if (!is_array($statArr)) throw new Exception ("Non-array argument ".$statArr);
    $this->stats=json_encode($statArr);
  }
  
  function getShips($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $s=json_decode($this->ships[$side],true);
    if (!is_array($s)) throw new Exception ("Failed to decode fleetModel from ".$this->ships);
    return $s;
  }
  
  function setShips($side,$fleetModel) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    if (!is_array($fleetModel)) throw new Exception ("Non-array argument ".$fleetModel);
    $this->ships[$side] = json_encode($fleetModel);
  }  
  
  function getMoves() {
    $m=json_decode($this->moves,true);
    if (!is_array($m)) throw new Exception ("Failed to decode moves from ".$this->moves);
    return($m);  
  }
  
  function addMove($next) {
    $m=$this->moves;
    $this->moves = HubHelper::appendToJson ( $m, $next );
  }
  
  function getRule($key) {
    $parsed=json_decode($this->rulesSet,true);
    if (!isset($parsed[$key])) throw new Exception("Invalid key:".$key."!");
    return($parsed[$key]);
  }
  
  function clearActive() { $this->activeSide=""; }
  
  function setActive($side) {
    if ( ! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $this->activeSide = $side;
  }
  
  function isActive($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    if ( $this->activeSide === $side ) return true;
    return false;
  }
  
  function getActive() { return($this->activeSide); }
  
  function incTotal() { $this->total+=1; }
  
  function getTotal() { return ($this->total); }
  
  function setTotal($t) { $this->total = $t; }

  function decClip() { $this->clip = $this->clip - 1; }
  
  function incClip() { $this->clip = $this->clip + 1; }
  
  function getClip() { return ($this->clip); }
  
  function setClip($v) { $this->clip = $v; }
  
  function export() {
    $r=[];
    $r["id"]=$this->id;
    $r["nA"]=$this->getName("A");
    $r["nB"]=$this->getName("B");
    $r["ti"]=$this->timeInit;
    $r["tc"]=$this->timeConnected;
    $r["tf"]=$this->timeFinished;
    $r["af"]=$this->agendaFile;
    $r["stage"]=$this->getStage();
    $r["state"]=$this->getState();
    $r["acs"]=$this->activeSide;
    $r["pA"]=$this->getPick("A");
    $r["pB"]=$this->getPick("B");
    $r["rl"]=$this->rulesSet;
    $r["sA"]=$this->ships["A"];
    $r["sB"]=$this->ships["B"];
    $r["ms"]=$this->moves;
    $r["st"]=$this->stats;
    $r["cl"]=$this->clip;
    $r["mt"]=$this->total;
    $r["wi"]=$this->winner;
    return $r;
  }
  
  function import($r) {
    if (!is_array($r)) throw new Exception ("Non-array argument");
    $this->id=$r["id"];
    $this->setName("A",$r["nA"]);
    $this->setName("B",$r["nB"]);
    $this->timeInit=$r["ti"];
    $this->timeConnected=$r["tc"];
    $this->timeFinished=$r["tf"];
    $this->agendaFile=$r["af"];
    $this->setStage($r["stage"]);
    $this->setState($r["state"]);
    $this->activeSide=$r["acs"];
    $this->setPick("A",$r["pA"]);
    $this->setPick("B",$r["pB"]);
    $this->rulesSet=$r["rl"];
    $this->ships["A"]=$r["sA"];
    $this->ships["B"]=$r["sB"];
    $this->moves=$r["ms"];
    $this->stats=$r["st"];
    $this->clip=$r["cl"];
    $this->total=$r["mt"];
    $this->winner=$r["wi"];
  }
  
  function recycle() {
    $this->timeInit=time();
    $this->timeConnected=time();
    $this->timeFinished=0;
    $this->setStage("ships");
    $this->setState("ships");
    $this->ships=["A"=>"[]","B"=>"[]"];
    $this->moves="[]";
    $this->stats = '{"A":'.$this->defaultStats.',"B":'.$this->defaultStats.'}';
    $this->setClip(0);
    $this->setTotal(0);
    $this->winner="";
  }
  
  function exportPair($keys) {
    if (!is_array($keys)) $keys=[ $keys ];
    $pairs=[];
    foreach ($keys as $key) {   
      if (! isset($this->$key) ) throw new Exception ("Invalid key:".$key."!");
      if ( is_array($this->$key) ) { 
        $val=json_encode($this->$key);
        $val=str_replace(['"{','}"'],['{','}'],$val);
        $val=str_replace(['"[',']"'],['[',']'],$val);
        $val=str_replace('\\"','"',$val);
        /*echo(">".$val);*/ 
      } 
      else if ( is_string($this->$key) && ( substr($this->$key,0,1)=="{" || substr($this->$key,0,1)=="[" ) ) $val=$this->$key;
      else $val='"'.$this->$key.'"';
      $pairs[]='"'.$key.'":'.$val;
    }
    return (implode(",",$pairs));
  }
  
  static function getOtherSide($side) {
    if (!in_array($side,self::$sides)) throw new Exception ("Wrong side:".$side."!");
    if ($side===self::$sides[0]) return (self::$sides[1]);
    if ($side===self::$sides[1]) return (self::$sides[0]);
  }
  
  function checkConverged() {
    $s0=self::$sides[0];
    $s1=self::$sides[1];
    $p0=$this->getPick($s0);
    $p1=$this->getPick($s1);
    // JSON strings are equal and contain all keys
    if ( $p0 === $p1 && substr_count( $p0, ":" ) == substr_count( $this->defaultPicks, ":" ) ) return true;
    return false;
  }
  
  function addToRulesSet($key,$val) {
    $rulesObj=json_decode($this->rulesSet,true);
    if ( !isset( $rulesObj[$key] ) ) throw new Exception ("Wrong key:".$key."!");
    $rulesObj[$key] = $val;
    $this->rulesSet = json_encode($rulesObj);
  }
  
}
?>