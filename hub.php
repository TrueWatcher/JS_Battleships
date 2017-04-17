<?php
// The server part of Battleships game.
// By TrueWatcher, Jan 2016
// v.0.0.3 decoupled HubManager from input and cookie, added trace
//   0.0.4 fixed '"{\"' in Game::exportPair
//   0.0.5 refactoring: new classes Intro and Rules 
//   0.0.6 minimal unit tests
//   2.0.4 add stage Ships
//   2.1.6 fully functional with some unit tests
//   2.1.7 added reqId test feature, refactoring
//   2.1.17 refactored HubManager, removed duplications in subcontrollers

class CommandException extends Exception {}
class AuthException extends Exception {}

require_once("Game.php");
/**
 * Allows for calling controller with mock input and cookie arrays.
 */
abstract class DetachableController {
  protected $input;
  protected $cookie;
  protected $helperClass;
  public $inState="*";
  public $outState="*";
  public $act=null;
  
  function __construct($input=null,&$cookie=null,$hc="HubHelper") {
    if( !isset($input) ) $this->input = $_REQUEST;
    else $this->input = $input;
    if( !isset($cookie) ) $this->cookie = & $_COOKIE;
    else $this->cookie = &$cookie;
    $this->helperClass = $hc;
  }
  
  abstract function go($action,Array $context=[]);
}

/**
 * The outermost controller.
 * Resolves game stage, instantiates and calls the appropriate subcontroller.
 * Also manages trace for debugging.
 */
class HubManager extends DetachableController {

  public $trace="";
  public $act="";
  
  protected $allowAuthByInput=1;
  
  /**
   * Array of subcontroller constructors.
   */
  protected static $stageClasses=["intro"=>"Intro", "rules"=>"Rules", "ships"=>"Ships", "fight"=>"Fight", "finish"=>"Finish", "adm"=>"Adm"];
  
  /**
   * Defines commands allowed without registration (most important registration itself).
   */
  protected $nonRegistered=[ "intro=register", "adm=rmDb" ];
  
  /**
   * Lets some commands to be executed when game is already in next stage.
   * And makes possible to ban all other mismatches.
   */
  protected $allowedStageMismatches=[ "intro=queryStage", "intro=queryAll", "intro=abort", "rules=queryPick", "rules=confirm", "ships=confirmShips", "ships=queryStage", "fight=queryMoves", "finish=new", "finish=queryStage", "adm=dumpPage" ];

  /**
   * Main controller entry point.
   * Very sensitive to the logical order of operations.
   * @param dummy
   * @param dummy
   * @return string JSON-encoded response
   */
  public function go($act="",Array $context=[]) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
    
    $act=""; 
    $aStage="*";
    $stage="zero"; $state="zero";
    $context=["db"=>null,"name"=>"*","side"=>"*","id"=>"*","otherSide"=>"*","gameObj"=>null,"stage"=>"zero","state"=>"zero"];
    $credentials=[];
    $r="{}";// JSON string
    $inState=$outState=$inStage=$outStage="*";// in trace reads as "unknown, probably same as prior to this action"

    try {
      $r=$this->returnRequestId($r,$input);
      list($act,$aStage)=$this->readCommandStage($input);// throws excCommand
      $credentials=$this->readCredentials($cookie,$input);// does not throw excAuth, just returns error message
      if ( ! is_array($credentials) ) {
        $context=$this->nonRegContext($act,$aStage,$credentials);// throws ExcAuth
      } 
      else {
        $context=$this->getGame($credentials);// throws excAuth
      }
      $inState=$context["state"];
      $stage=$this->checkStage($act,$aStage,$context["stage"]);// throws excCommand on stage mismatch
      $stageController=$this->getStageController($aStage,$input,$cookie,$hc); // by aStage from input, not by actual stage of gameObj
      $stageController->inState = $inState;
      
      $rr=$stageController->go($act,$context);
      
      $r = $hc::appendToJson( $r, $rr);
      //$r=$rr;
      $inState = $stageController->inState;
      $outStage = $stageController->outStage;
      $r = $hc::appendToJson( $r, '"stage":"'.$outStage.'"' );
      $outState = $stageController->outState;
    } 
    catch (AuthException $ae) {
      $r = $hc::noteState($ae->getMessage(),"intro");
      if($context["db"]) { $context["db"]->destroy(); }
      exit($r);// minimal information
    }
    catch (CommandException $ce) { 
    // subcontroller not run, stage and state are taken from init
      $r = $hc::noteState($ce->getMessage(),$context["state"]);
      $r = $hc::appendToJson( $r, '"stage":"'.$context["stage"].'"' );
      // go on -- add trace etc.
    }
    
    if($context["db"]) { $context["db"]->destroy(); }
    $this->track( [ $aStage, $inState, $act, $outState, $hc::collectKeys2($r) ] );
    $r=$hc::appendToJson($r,'"trace":"'.$this->trace.'"');
    return($r); 
  }// end go
  
  /**
   * Detects reqId field in the input and appends it to the output.
   * May be helpful to client if client's AJAX requests collide.
   * @param string json-encoded response
   * @param array $input
   * @return string modified json-encoded response
   */
  protected function returnRequestId($r,$input) {
    if(isset($input["reqId"])) return ( '{"reqId":"'.$input["reqId"].'"}' );
    return $r;
  }
  
  /**
   * Finds and parses pair stage=command from an input.
   * @param array $input
   * @return array [command,stage]
   * @throws CommandException
   */
  protected function readCommandStage(Array $input) {
    $stage=$this->detectStage($input);
    if ( isset($input[$stage]) ) {
      $command = $input[$stage];
    }
    else { throw new CommandException("Empty command"); }
    return ([$command,$stage]);
  }
  
  /**
   * Finds stage in input.
   * @param array $input
   * @return string stage if found
   * @throws CommandException
   */
  protected function detectStage(Array $input) {
    //$lookup=["intro","rules","ships","fight","finish","adm"];
    $lookup=array_keys(self::$stageClasses);
    foreach($lookup as $k) {
      if (array_key_exists($k,$input)) return $k;
    }
    throw new CommandException("Empty or invalid input");
    //return false;
  }
  
  /**
   * Reads name,side and dealId from cookie or input.
   * @return array|string array on success, error message on failure
   */
  protected function readCredentials($cookie,$input) {
    $hc=$this->helperClass;
    $name=$side=$id='';
    if ($this->allowAuthByInput && isset($input["reqId"]) ) { 
      if ( ! $hc::readReqId($input["reqId"],$name,$side,$id) ) {
        return("Failed to parse reqId=".$input["reqId"]);     
      }
    }
    else if ( ! $hc::readCookie($cookie,$name,$side,$id) ) {
      return("Please, register");
    }
    //return (["name"=>$name,"side"=>$side,"id"=>$id]);
    return ([$name,$side,$id]);
  }
  
  /**
   * Provides subcontroller context when there are no client credentials and therefore no gameObject can be retrieved.
   * @param string $command
   * @param string $aStage
   * @param string $errorMsg from readCredentials
   * @return array
   * @throws AuthException
   */
  protected function nonregContext($command,$aStage,$errorMsg) {
    $pair=$aStage."=".$command;
    if ( ! in_array($pair,$this->nonRegistered) ) { throw new AuthException($errorMsg); }
    $db=new RelaySqlt(true);
    return(["db"=>$db,"name"=>"*","side"=>"*","id"=>"*","otherSide"=>"*","gameObj"=>null,"stage"=>"*","state"=>"*"]);
  }
  
  /**
   * Gets gameObject from database by client's credentials.
   * @param array $sideNameId from readCredentials
   * @return array
   * @throws AuthException
   * @throws Exception
   */
  protected function getGame($sideNameId) {
    $hc=$this->helperClass;
    if (! is_array($sideNameId)) throw new Exception ("Non-array argument:".$sideNameId);
    list($name,$side,$id)=$sideNameId;
    
    $otherSide=Game::getOtherSide($side);
    $db=new RelaySqlt(true);
    try {
      $gameObj=$hc::findRecord($db,$name,$side,$id);
    }
    catch (Exception $e) { throw new AuthException($e->getMessage()); }
    $state=$gameObj->getState();
    $gStage=$gameObj->getStage();
    return(["db"=>$db,"name"=>$name,"side"=>$side,"id"=>$id, "otherSide"=>$otherSide,"gameObj"=>$gameObj,"stage"=>$gStage,"state"=>$state]);
  }
  
  /**
   * Checks game stage from input against database record.
   * @param string $command
   * @param string $aStage from input
   * @param string $gStage from getGame
   * @return string $aStage if same or allowed different
   * @throws CommandException
   */
  protected function checkStage($command,$aStage,$gStage) {
    if ($gStage===$aStage) return ($aStage);
    if ($gStage==="*")  return ($aStage);// authentication was legally bypassed
    $pair=$aStage."=".$command;
    if ( in_array($pair,$this->allowedStageMismatches) ) return ($aStage);
    throw new CommandException("Out-of-order command/stage:".$command."/".$aStage." while in stage ".$gStage);
  }
  
  /**
   * Instatantiates the required subcontroller.
   * @param string $aStage stage from input
   * @param array  $input input-output!
   * @param array  $cookie input-output!
   * @param string $hc 
   * @return object
   */
  protected function getStageController($aStage,&$input,&$cookie,$hc) {
   $Sc = self::$stageClasses [$aStage];
   $stageController = new  $Sc($input,$cookie,$hc);
   return ($stageController);
  }
  
  /**
   * Adds items to the trace.
   * @param mixed|array $subj
   * @return void
   */
  protected function track($subj) {
    $separator=">";
    if (!is_array($subj)) $subj=[$subj];
    foreach ($subj as $str) {
      if ( $str===false ) $str="false";
      if (!$str) $str="null";
      $this->trace.=$separator.$str;
    }
  }
  
}// end HubManager

require_once("controllers.php");
    
class HubHelper {
  
  /**
   * Sorts out context array into variables.
   * @param array $c
   * @params mixed output!
   * @return void
   */
  static function importContext(Array $c, &$db,&$name,&$side,&$id,&$otherSide,&$g,&$stage,&$state) {
    $db=$c["db"];
    $name=$c["name"];
    $side=$c["side"];
    $id=$c["id"];
    $otherSide=$c["otherSide"];
    $g=$c["gameObj"];
    $stage=$c["stage"];
    $state=$c["state"];
  }

  /**
   *
   * @return false on failure, non-false on success
   */
  static function readCookie($cookie,&$name,&$side,&$dealId) {
    if (empty($cookie)) return false;
    $name=$letter=$dealId="";
    $i=0;
    if ( isset($cookie["name"]) ) {
      $name=$cookie["name"];
      $i++;
    }
    if ( isset($cookie["side"]) ) {
      $side=$cookie["side"];
      $i++;
    }
    if ( isset($cookie["dealId"]) ) {
      $dealId=$cookie["dealId"];
      $i++;
    }
    if ($i<>3) return false;
    return $i;
  }
  
  /**
   *
   * @return false on failure, non-false on success
   */  
  static function readReqId($reqId,&$name,&$side,&$dealId) {
    if ( empty($reqId) ) return false;
    // reqId=John_B_10_77
    $details=explode("_",$reqId);
    if ( count($details) < 3 || strlen(implode("",$details)) < 3 ) return false;
    $name=$details[0];
    $side=$details[1];
    $dealId=$details[2];
    return true;
  }
  
  /**
   * @param array $cookie output needed for DetachedHubHelper::clearCookies
   * @return void
   */
  static function clearCookies(&$cookie) {
    setcookie("name","",time()-1000);
    setcookie("side","",time()-1000);
    setcookie("dealId","",time()-1000);
  }

  /**
   * @param array $cookie output needed for DetachedHubHelper::setCookie
   * @return void
   */  
  static function setCookie(&$cookie,$name,$side,$dealId) {
    setcookie("name",$name);
    setcookie("side",$side);
    setcookie("dealId",$dealId);
  }
  
  /**
   *
   * @return json string
   */
  static function fail($note,$state=null) {
    $r='{"error":1,"note":"'.$note.'"}';
    if ($state) self::appendToJson($r,'"state":'.$state);
    return($r);
  }
  
  /**
   *
   * @return json string
   */
  static function noteState($note,$state) {
    $r='{"state":"'.$state.'","note":"'.$note.'"}';
    return $r;
  }
  
  /**
   * Compiles JSON string from a note and several Game object fields.
   * @uses Game::exportPair
   * @param string $note
   * @param object Game $g
   * @param string|array $keys
   * @return json string
   */
  static function notePairs($note,Game $g, $keys) {
    $r='{"note":"'.$note.'",'.$g->exportPair($keys).'}';
    return $r;
  }
  
  /**
   * Reads a Game object from database with some checks.
   * @param object RelaySqlt $db
   * @param string $name a player name
   * @param string $side A or B
   * @param string $id game Id from HubHelper::readCookie
   * @return {object Game}
   * @throws Exception
   */
  static function findRecord(RelaySqlt $db,$name,$side,$id) {
    $rec=$db->readGame($id);
    if (!$rec) throw new Exception("Wrong id:".$id."!");//return (false);
    $g=new Game();
    if (! in_array($side,Game::$sides) ) throw new Exception("Wrong side:".$side."!");
    $g->import($rec);
    if ( $name !== $g->getName($side) ) throw new Exception("Name ".$name." and id ".$id." don't match");
    return($g);
  }

  /**
   * Appends a pair key:value to existing JSON string.
   * @param string $json
   * @param string $pair key:value or {key1:value1,key2:value2,..}
   * @return string
   */  
  static function appendToJson($json,$pair) {
    $l=strlen($json);
    if ($l<2) throw new Exception ("Too small JSON argument :".$json."!");
    $last=substr($json,$l-1,1);
    if ( $last!="}" && $last!="]" ) throw new Exception ("Invalid JSON argument termination :".$last."!");
    
    $lp=strlen($pair);
    $pairFirst=substr($pair,0,1);
    $pairLast=substr($pair,$lp-1,1);
    if ($pairFirst=="{" || $pairFirst=="[") {
      // 2nd argument seems to be json, not just a pair
      if ( ($pairFirst=="{" && $pairLast != "}") || ($pairFirst=="[" && $pairLast != "]") ) throw new Exception ("Invalid 2nd argument delimiters :".$pairFirst.",".$pairLast."!");
      if ($pairLast!=$last) throw new Exception ("2nd argument delimiters do not match 1st argument delimiters :".$pairLast.",".$last."!");
      $pair=substr($pair,1,$lp-2);// strip delimiters
    }
    if (strlen($pair)==0) return $json;
    if ($l>2) { $r=substr($json,0,$l-1).",".$pair.$last; }
    else { $r=substr($json,0,1).$pair.$last; }// just wrap pair in delimiters
    return $r;
  }
  
  /**
   * Collects keys from the upper and next levels of nested JSON array.
   * While debugging catches the response format errors.
   ^ @param string $json
   * @param string $separator
   * @return string
   */
  static function collectKeys2($json,$separator="_") {
    $keys=[];
    //echo("==".$json."==");
    $obj=json_decode($json,true);
    //var_dump($obj);
    if (!is_array($obj)) { echo("\nFailed to decode:\n".$json."\n"); }
    foreach( $obj as $k1=>$v1 ) {
      $keys[]=$k1;
      if ( is_array($v1) || is_object($v1) ) {
        foreach ( $v1 as $k2=>$v2 ) {
          $keys[]=$k2;
        }
      }
    }
    return (implode($separator,$keys));
  }
  
  static function implodePlus($arg,$separator=",") {
    if (is_string($arg)) {
      try { $arr=json_decode($arg,true); } 
      catch (Exception $e) { throw new Exception("implodePlus: argument1=".$arg." is string but not a valid json"); }
    }
    else if (is_array($arg)) { $arr=$arg; }
    else throw new Exception("implodePlus: argument1=".$arg." is of invalid type");
    
    $r="";
    foreach($arr as $key=>$val) {
      if (!is_array($val)) $r.=$separator.$val;
      else $r.=$separator.self::implodePlus($val);
    }
    return ltrim($r,$separator);
  }
}
/**
 * Overrides some methods for use in unit testing of HubManager and subcontrollers.
 */
class DetachedHubHelper extends HubHelper {
  static function setCookie(&$cookie,$name,$side,$dealId) {
    $cookie["name"]=$name;
    $cookie["side"]=$side;
    $cookie["dealId"]=$dealId;
  }
  
  static function clearCookies(&$cookie) {
    $cookie = [];
  }
}

/**
 * A container for database handler.
 */
class RelayDb {

  protected static $relayDbo=null;// DB handler

  protected function __construct($relayDbFile,$allowCreate) {
    if (! is_null(self::$relayDbo) ) {
      throw new Exception ("You are supposed to have only one instance of RelayDb class");
      //return(0);
    }
    self::$relayDbo = new SQLite3($relayDbFile,SQLITE3_OPEN_CREATE|SQLITE3_OPEN_READWRITE);
    self::$relayDbo -> busyTimeout(5000); // required for concurrency
  }
}// end forumDb

/**
 * Transaction scripts for the database.
 */
class RelaySqlt extends RelayDb {
  
  protected static $table="game";

  function __construct($allowCreate=false,$tableName=null) {
    $relayName="game";
    $path="";
    if (defined("URLOFFSET")) $path=URLOFFSET;
    $relayDbFile=$path.$relayName.".db";
    if( !empty($tableName) ) self::$table=$tableName;

    if (! file_exists($relayDbFile) ) {
      if (! $allowCreate) { // alas
        throw new Exception ("Missing or inaccessible database file : ".$relayDbFile);
      }
      else { // try to create new database
        touch($relayDbFile);
        if (! file_exists($relayDbFile) ) { // failed to create file
          throw new Exception ("Cannot create new database file : ".$relayDbFile.", check the folder permissions");
        }
      }
      // new db file was created
      parent::__construct($relayDbFile,true);
      $this->createTable(self::$table);
    }
    else {
    // db file was found ready
      parent::__construct($relayDbFile,false);
    }
  }
  
  function destroy() {
    if (parent::$relayDbo) parent::$relayDbo->close();
    parent::$relayDbo=null;
  }

  public function createTable($tableName) {
    // AUTOINCREMENT with PRIMARY KEY prevent the reuse of ROWIDs from previously deleted rows.
    // https://www.sqlite.org/autoinc.html
    $qCreateTable="CREATE TABLE '".$tableName."' (
      id INTEGER PRIMARY KEY,
      nA TEXT,
      nB TEXT,
      ti TEXT,
      tc TEXT,
      tf TEXT,
      af TEXT,
      stage TEXT,
      state TEXT,
      acs TEXT,
      pA TEXT,
      pB TEXT,
      rl TEXT,
      sA TEXT,
      sB TEXT,
      ms TEXT,
      st TEXT,
      cl TEXT,
      mt TEXT,
      wi TEXT
    )";
    //       mA TEXT,  mB TEXT,
    $ret = parent::$relayDbo->exec($qCreateTable);
    //echo(">".$ret);
  }

  protected static $dbKeys=["nA", "nB", "ti", "tc", "tf", "af", "stage", "state", "acs", "pA", "pB", "rl", "sA", "sB",/* "mA", "mB", */"ms", "st", "cl", "mt", "wi"];
  
  public function saveGame(Game $g,$overwrite=false) {
    $arr=$g->export();
    $dealDbKeys=array_keys($arr);
    $diff1=array_diff(self::$dbKeys,$dealDbKeys);
    $diff2=array_diff($dealDbKeys,self::$dbKeys);// must be ["id"]
    if ( !empty($diff1) ) throw new Exception ("Key missing from object:".implode(",",$diff1)); 
    if ( count($diff2)>1 ) throw new Exception ("Key missing from db:".implode(",",$diff2));
    $qAdd="INSERT INTO '".self::$table."' (";
    $qAdd.=implode(", ",self::$dbKeys);
    $qAdd.=") VALUES ( ";
    $qAdd.=":".implode(", :",self::$dbKeys);
    $qAdd.=")";
    
    $qUpd="UPDATE '".self::$table."' SET ";
    $pairs=[];
    foreach (self::$dbKeys as $k) {
      $pairs[]= $k."=:".$k;
    }
    $qUpd.=implode(", ",$pairs);
    $qUpd.=" WHERE id=:id";
    
    if (!$overwrite) $stmt=parent::$relayDbo->prepare($qAdd);
    else {
      $stmt=parent::$relayDbo->prepare($qUpd);
      $stmt->bindValue( ':id', $arr["id"], SQLITE3_INTEGER );
    }
    foreach (self::$dbKeys as $k) {
      $stmt->bindValue( ':'.$k, $arr[$k], SQLITE3_TEXT );
    }
    $stmt->execute();
    return( parent::$relayDbo->lastInsertRowID() );
  }
  
  function readGame($id) {
    $qRead="SELECT ";
    $qRead.="id, ".implode(", ",self::$dbKeys);
    $qRead.=" FROM '".self::$table."' WHERE id=:id";
    $stmt=parent::$relayDbo->prepare($qRead);
    $stmt->bindValue(':id',$id,SQLITE3_INTEGER);
    $result = $stmt->execute();
    $arr=$result->fetchArray(SQLITE3_ASSOC);
    return($arr);
  }
  
  function findOpenByB($nameB) {
    $qFindOpenB="SELECT id FROM '".self::$table."' WHERE state='connecting' AND ( nB=:nB )";// OR nA=;nA)
    $stmt=parent::$relayDbo->prepare($qFindOpenB);
    $stmt->bindValue(':nB',$nameB,SQLITE3_TEXT);
    $result = $stmt->execute();
    $found = $result->fetchArray();
    if (!$found) return false;
    return($found[0]);
  }
  
  function findActiveByAB($nameA,$nameB) {
    $qFindActiveAB="SELECT id FROM '".self::$table."' WHERE (stage<>'finish') AND (stage <>'aborted') AND state<>'finish' AND state<>'aborted'  AND nA=:nA AND nB=:nB"; 
    $stmt=parent::$relayDbo->prepare($qFindActiveAB);
    $stmt->bindValue(':nA',$nameA,SQLITE3_TEXT);
    $stmt->bindValue(':nB',$nameB,SQLITE3_TEXT);
    $result = $stmt->execute();
    $found = $result->fetchArray();
    if (!$found) return false;
    return($found[0]);
  }
  
  function kill($id) {
    $qKill="UPDATE '".self::$table."' SET state='aborted' WHERE id=:id";
    $stmt=parent::$relayDbo->prepare($qKill);
    $stmt->bindValue(':id',$id,SQLITE3_INTEGER);
    $result = $stmt->execute();
  }

}// end RelaySqlt

// MAIN

$controller=new HubManager();
$ret=$controller->go();
//echo("Trace:".$controller->trace);
print($ret);

?>