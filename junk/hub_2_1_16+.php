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
  
  abstract function go($action);
}

/**
 * The outermost controller.
 * Resolves game stage, instantiates and calls the appropriate subcontroller.
 * Also manages trace for debugging.
 */
class HubManager extends DetachableController {

  public $trace="";
  public $act="";
  
  function track($subj) {
    $separator=">";
    if (!is_array($subj)) $subj=[$subj];
    foreach ($subj as $str) {
      if ( $str===false ) $str="false";
      if (!$str) $str="null";
      $this->trace.=$separator.$str;
    }
  }

  public static $stageClasses=["intro"=>"Intro", "rules"=>"Rules", "ships"=>"Ships", "fight"=>"Fight", "finish"=>"Finish", "adm"=>"Adm"];
  
  function go($action) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id="";
    $stage="";
    $state="*";
    $r=null;
    
    $stage=$hc::detectStage($input);
    if ( !$stage ) {
      $r=$hc::fail("Invalid input","zero");
      $this->track( [ $state, $state, $hc::collectKeys2($r) ] );
      $r=$hc::appendToJson($r,'"trace":"'.$this->trace.'"');
      return($r);
    }
    $sc = self::$stageClasses [$stage];
    $stageController = new  $sc($input,$cookie,$hc);
    if ( isset($input[$stage]) ) {
      $this->act = $input[$stage];
    }
    
    $r = $stageController->go($this->act);
    
    //$r=$hc::appendToJson($r,'"stage":"'.$this->stage.'"');
    $this->track( [ $stage, $stageController->inState, $this->act, $stageController->outState, $hc::collectKeys2($r) ] );
    $r=$hc::appendToJson($r,'"trace":"'.$this->trace.'"');
    return($r);    
  }
}// end HubManager

require_once("controllers.php");
    
class HubHelper {

  static function detectStage($input) {
    //$lookup=["intro","rules","ships","fight","finish","adm"];
    $lookup=array_keys(HubManager::$stageClasses);
    foreach($lookup as $k) {
      if (array_key_exists($k,$input)) return $k;
    }
    return false;
  }

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
  
  static function init($cookie,$input,$aStage,$command,$dbClass="RelaySqlt") {
    $name="";
    $side=$otherSide="";
    $id="";
    $pair=$aStage."=".$command;
    $unregistered=["intro=register","adm=rmDb"];
    $state="*";
    $gameObj=null;
    $allowAuthByInput=1;
    
    $db=new $dbClass(true);
    
    if ( ! in_array($pair,$unregistered) ) {
      if ($allowAuthByInput && isset($input["reqId"]) ) { 
        if ( ! self::readReqId($input["reqId"],$name,$side,$id) ) {
          $r = self::fail("Failed to parse reqId=".$input["reqId"]);
          exit($r);      
        }
      }
      else if ( ! self::readCookie($cookie,$name,$side,$id) ) {
        $r = self::noteState("Please, register","intro");
        exit($r);
      }
    
      $otherSide=Game::getOtherSide($side);
      $gameObj=self::findRecord($db,$name,$side,$id);
      $state=$gameObj->getState();
    }
    else {}
    return ([$db,$name,$side,$otherSide,$state,$gameObj]);
  }
  
  static function clearCookies(&$cookie) {
    setcookie("name","",time()-1000);
    setcookie("side","",time()-1000);
    setcookie("dealId","",time()-1000);
  }
  
  static function setCookie(&$cookie,$name,$side,$dealId) {
    setcookie("name",$name);
    setcookie("side",$side);
    setcookie("dealId",$dealId);
  }
  
  /**
   *
   * @return string
   */
  static function fail($note,$state=null) {
    $r='{"error":1,"note":"'.$note.'"}';
    if ($state) self::appendToJson($r,'"state":'.$state);
    return($r);
  }
  
  /**
   *
   * @return string
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
   * @return string
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
   * @param string $pair
   * @return string
   */  
  static function appendToJson($json,$pair) {
    $l=strlen($json);
    if ($l<2) throw new Exception ("Too small JSON argument :".$json."!");
    $last=substr($json,$l-1,1);
    if ( $last!="}" && $last!="]" ) throw new Exception ("Invalid JSON argument termination :".$last."!");
    if ($l>2) { $r=substr($json,0,$l-1).",".$pair.$last; }
    else { $r=substr($json,0,1).$pair.$last; };
    return $r;
  }
  
  /**
   * Collects keys from the upper and next levels of nested JSON array.
   ^ @param string $json
   * @param string $separator
   * @return string
   */
  static function collectKeys2($json,$separator="_") {
    $keys=[];
    //echo("==".$json."==");
    $obj=json_decode($json,true);
    //var_dump($obj);
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
    if (URLOFFSET) $path=URLOFFSET;
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
$ret=$controller->go(null);
//echo("Trace:".$controller->trace);
print($ret);

?>