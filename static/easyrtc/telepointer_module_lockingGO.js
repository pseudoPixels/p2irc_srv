var all_occupants_list = ""; //list of easyrtcid of all the logged in clients
var all_occupants_details = []; //list of logged in clients along with email, name and corresponding easyrtcid
var selfEasyrtcid = ""; //my own easyrtc id

//user info required for rtc
var user_name = "";
var user_email = "";



//IMPORTANT
//this id remain unique throughout the pipeline for a module
var unique_module_id = 1;

//all the node access requests are kept in the Q to serve as FIFO
var nodeAccessRequestsQueue = [];

$(document).ready(function(){


//alert("Doc Loaded");


//TODO: NEED TO MAKE IT RELATIVE
var WORKFLOW_OUTPUTS_PATH = '/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/';
//TODO: GET IT FROM USER (WORKFLOW NAME FIELD)
var THIS_WORKFLOW_NAME = 'test_workflow';



























































//========================================================
//================ ALL INITIALIZATION CODES STARTS =======
//========================================================

    //connect and login to the easyrtc node server.
    connect();


    //get the user required information from the DOM
    user_name = $("#user_name").text();
    user_email = $("#user_email").text();





//========================================================
//================ ALL INITIALIZATION CODES ENDS =========
//========================================================












//========================================================
//===================== COLLABORATION CODE STARTS ========
//========================================================

    //chat room communication
    $("#chatRoom_send_msg_btn").click("on", function(){

        var text = $("#chatRoom_send_msg_txt").val(); //get the msg content

        if(text.replace(/\s/g, "").length === 0) { // Don"t send just whitespace
            return;
        }

        //empty the text box for further msg
        $("#chatRoom_send_msg_txt").val("");

        //create the telegram for all the clients.
        //as its a chat room msg, we don't specify the reciever.
        var telegram = {"sender": user_name, "msg": text};
        var telegram_for_myself = {"sender": "Me", "msg": text};

        //add to my chat room conversation
        addToChatRoomConversation(telegram_for_myself);

        //and also send to all other clients for adding to their chat room conversation
        notifyAll("chat_room_msg", telegram);

    });



        //Collaborative white board
    var canvas = document.getElementById("mycanvas");
    var context = canvas.getContext('2d');

    var clickX = new Array();
    var clickY = new Array();
    var clickDrag = new Array();
    var paint;

    function addClick(x, y, dragging) {
      clickX.push(x);
      clickY.push(y);
      clickDrag.push(dragging);
    }


    $('#mycanvas').mousedown(function(e) {
            var rect = e.currentTarget.getBoundingClientRect(),
          offsetX = e.clientX - rect.left,
          offsetY = e.clientY - rect.top;

      var mouseX = e.pageX - this.offsetLeft;
      var mouseY = e.pageY - this.offsetTop;



      paint = true;
      addClick(offsetX, offsetY);
      redraw();
    });


    $('#mycanvas').mousemove(function(e) {
            var rect = e.currentTarget.getBoundingClientRect(),
          offsetX = e.clientX - rect.left,
          offsetY = e.clientY - rect.top;

          //alert(offsetX);

      if (paint) {
        addClick(offsetX, offsetY, true);
        redraw();
      }
    });


    $('#mycanvas').mouseup(function(e) {
      paint = false;
    });


    $('#mycanvas').mouseleave(function(e) {
      paint = false;
    });


    function redraw() {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas

      context.strokeStyle = "#df4b26";
      context.lineJoin = "round";
      context.lineWidth = 3;

      for (var i = 0; i < clickX.length; i++) {
        context.beginPath();
        if (clickDrag[i] && i) {
          context.moveTo(clickX[i - 1], clickY[i - 1]);
        } else {
          context.moveTo(clickX[i] - 1, clickY[i]);
        }
        context.lineTo(clickX[i], clickY[i]);
        context.closePath();
        context.stroke();
      }
    }
    //collaborative white board ends



    //Hidden Display controls
    $("#id_collaborativeToolsDiv").click("on", function(){
        $("#collaboration_tools").toggle(750);
    });

    $("#id_chatRoomDiv").click("on", function(){
        $("#chatRoom").toggle(750);
    });

    $("#id_canvasDiv").click("on", function(){
        $("#whiteBoard").toggle(750);
    });

    $("#id_workflow_tree_view").click("on", function(){
        $("#tree-simple").toggle(750);
    });


//========================================================
//===================== COLLABORATION CODE ENDS ==========
//========================================================
















//========================================================
//===================== EASYRTC CODE STARTS ==============
//========================================================


$(document).mousemove(function(e){
    var my_telepointer_info = {"left":e.pageX-50,
                             "top":e.pageY-50,
                             "email":user_email,
                             "rtcid": selfEasyrtcid,
                             "user_name":user_name
                            };

    notifyAll("telepointer_info", my_telepointer_info);


});










//Notify all the other clients of the message with the passed message type.
function notifyAll(messageType, message){
    //loop through all the other clients and send the message.
    for(var otherEasyrtcid in all_occupants_list) {
            easyrtc.sendDataWS(otherEasyrtcid, messageType,  message);
    }
}










//Message reciver for the message sent from other clients.
//this method performs actions according to the received msgType
function onMessageRecieved(who, msgType, content) {

    switch(msgType) {
        case "telepointer_info":
            updateTelepointer(content);
            break;
        case "inform_my_details_to_all_other_clients":
            addNewClientToAllOccupantsDetails(content);
            updateOnlineStatusOfClients(all_occupants_details);
            break;
        case "disconnected":
            alert("Disconnected : " + content);
            break;
        case "chat_room_msg":
            addToChatRoomConversation(content);
            break;
        case "remote_module_addition":
            onWorkflowModuleAdditionRequest(content.whoAdded, content.newModuleID, content.newModuleName);
            break;
        case "node_access_request":
            //var requestInfo ={"nodeID":nodeID, "requestedBy":user_email};
            onNodeAccessRequest(content.requestedBy, content.nodeID);
            break;
        case "node_access_release":
            onNodeAccessRelease(content.nodeID, content.requestedBy)
            break;
        case "parentChanged":
            onModuleParentChange(content.moduleID, content.newParentID, content.parentIndex);
            break;
        case "moduleSettingsChanged":
            onModuleSettingsChanged(content);
            break;

        case "workflow_obj_new_link_drawn":
            addNewLinkToWorkflowObject(content);
            break;
        case "workflow_obj_selection_moved":
            workflowObjSelectionMoved(content);
            break;
        case "workflow_obj_selection_node_delete":
            workflowObjRemoveNode(content);
            break;
        case "workflow_obj_selection_link_delete":
            workflowObjRemoveLink(content);
            break;

    }
}



function onModuleSettingsChanged(changeInfo){
    $(changeInfo.elementInfo).eq(changeInfo.paramIndex).val(changeInfo.newParamValue).change();
}



//add the newly obtained client details to the list (e.g. like phonebook)
function addNewClientToAllOccupantsDetails(newClientDetails){
    all_occupants_details.push(newClientDetails);
}


function addToChatRoomConversation(telegram){
  // Escape html special characters, then add linefeeds.
  var content = telegram.msg;
  var sender = telegram.sender;
  content = content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  content = content.replace(/\n/g, "<br />");

  sender = "<strong>" + sender + "</strong>";

  var previous_messages = $("#chatRoom_all_msg").html();

  $("#chatRoom_all_msg").html(previous_messages + sender + ": " +content + "<br/>");

}


//update online status based on the available clients
function updateOnlineStatusOfClients(all_occupants_details){
    //first every user's status label to offline
    $(".online_status").text(' (Offline) ').css('color', '#C0C0C0');

    //then update the online status based on logged in clients.
    for(var i=0; i<all_occupants_details.length; i++){
        var userEmail = all_occupants_details[i].email;
        $('#online_status_'+convertEmailToID(userEmail)).text(' (Online) ').css('color', '#0f0');
    }
}







function convertEmailToID(email){
    //an email to be id, must not contain some special characters
    //TODO: currently removed occurance of any . or @ by _ need to handle other special characters too
    return email.replace(/\.|@/g, '_');
}





function connect() {
    easyrtc.setSocketUrl(":8080");
    easyrtc.setPeerListener(onMessageRecieved);
    easyrtc.setRoomOccupantListener(userLoggedInListener);
    easyrtc.connect("easyrtc.instantMessaging", loginSuccess, loginFailure);
}



//callback function, called upon new client connection or disconnection
function userLoggedInListener (roomName, occupants, isPrimary) {
    //update the global occupants list for this user.
    all_occupants_list = occupants;

    //as this callback method is also called on any user disconnection...
    //remove any 'zombie' easyrtc id from 'all_occupants_details' variable
    removeZombieClientsFromOccupantsDetails(occupants);

    //update the online/offline status as per the new list.
    //this update is important for someone leaves the connection.
    updateOnlineStatusOfClients(all_occupants_details);

    //spawn telepointers for the logged in users.
    spawnTelepointers(occupants);

    //inform my email, name along with easyrtc id, which is later used for different tracking
    informMyDetailsToAllOtherClients(occupants);

    //notifyAll('disconnected', "Hello");
}


//removes any invalid ids (the users of whom have left/disconnect)
//from the server. the passed occupants is the updated list of easyrctid
//the occupants_details are updated (removed the invalids) accordingly
function removeZombieClientsFromOccupantsDetails(occupants){
    var temp_occupants_details = [];

    for(var i=0;i < all_occupants_details.length; i++){
        var aClient = all_occupants_details[i];

        var isValid = 0;

        for(aEasyrtcid in occupants){
            if(aEasyrtcid == aClient.easyrtcid){
                isValid = 1; //this client is still on the list and online (connected and valid)
                break;
            }
        }

        //add the valid client to the temporary updated list
        if(isValid ==1){
            temp_occupants_details.push(aClient);
        }

    }

    //finally assign the temp new occupants details as the updated occupants details.
    all_occupants_details = temp_occupants_details;


}





//inform all other clients about my details: name, email, easyrtcid
//these additional info along with easyrtcid (which is available in
//'all_occupants_list') are used for mapping (e.g. which easyrtcid
//is for which emails and so on)
function informMyDetailsToAllOtherClients(occupants){
    var myInfo = {'email': $("#user_email").text(), 'easyrtcid': selfEasyrtcid, 'name': $("#user_name").text()};

    //notify all other clients for email for corresponding easyrtcid
    notifyAll('inform_my_details_to_all_other_clients', myInfo);
}







//spawn the telepointers for the passed occupants
function spawnTelepointers(occupants){

    //==================================================
    //spawn the telepointers for all the connected users.
    //==================================================
    var telepointer_spawn_point = document.getElementById('telepointer_spawn_point');
    //first remove any existing telepointer for a fresh start
    while (telepointer_spawn_point.hasChildNodes()) {
        telepointer_spawn_point.removeChild(telepointer_spawn_point.lastChild);
    }
    //and then create elements for occupants with corresponding easyrtcid
    for(var easyrtcid in occupants) {
            var ele = document.createElement("div");
            ele.setAttribute("id","telepointer_name_"+easyrtcid);

            ele.style.color = "#000";
            ele.style.backgroundColor =  "#fff";
            ele.style.boxShadow = "2px 2px 3px grey";
            //ele.setAttribute("class","inner");
            //ele.innerHTML="hi "+easyrtcid;
            telepointer_spawn_point.appendChild(ele);
    }
}












//update the telepointer for the other clients
//the 'content' should contain the required info for telepointer update
//along with other client easyrtcid; which is used for selecting the specific
//element from dom
function updateTelepointer(content){
    //telepointer was spawned according to the easyrtc id.
    //telepointer selected first and then updatee the css for rendering
    $('#telepointer_name_'+content.rtcid).css({position:'absolute',left:parseInt(content.left), top:parseInt(content.top)});
    if($('#telepointer_name_'+content.rtcid).text()=="")$('#telepointer_name_'+content.rtcid).html(content.user_name);

}








function sendStuffWS(otherEasyrtcid) {
    var text = document.getElementById('sendMessageText').value;
    if(text.replace(/\s/g, "").length === 0) { // Don't send just whitespace
        return;
    }

    easyrtc.sendDataWS(otherEasyrtcid, "message",  text);
    addToConversation("Me", "message", text);
    document.getElementById('sendMessageText').value = "";
}




function loginSuccess(easyrtcid) {
    selfEasyrtcid = easyrtcid;
    //document.getElementById("iam").innerHTML = "I am " + easyrtcid;
}


function loginFailure(errorCode, message) {
    easyrtc.showError(errorCode, message);
}

//========================================================
//===================== EASYRTC CODE ENDS ================
//========================================================



















//========================================================
//================ GO CODES STARTS =======================
//========================================================
    myDiagram='';
    //function init() {

    var $$ = go.GraphObject.make;

    myDiagram =
      $$(go.Diagram, "myDiagramDiv",
        {
          initialContentAlignment: go.Spot.Center,
          initialAutoScale: go.Diagram.UniformToFill,

          "undoManager.isEnabled": true
        }
      );
 	myDiagram.grid.visible = true;
    // when the document is modified, add a "*" to the title and enable the "Save" button
    /*myDiagram.addDiagramListener("Modified", function(e) {
      var button = document.getElementById("SaveButton");
      if (button) button.disabled = !myDiagram.isModified;
      var idx = document.title.indexOf("*");
      if (myDiagram.isModified) {
        if (idx < 0) document.title += "*";
      } else {
        if (idx >= 0) document.title = document.title.substr(0, idx);
      }
    });*/


  // validate if the linking modules have the same (compatible) data type
  function validateSameDataTypeOfModulesAndNodeAccessibility(fromnode, fromport, tonode, toport) {
    //portID => port_identifier(portDataType)
    //var portOneDataType = fromport.portId.split('(')[fromport.portId.split('(').length - 1]; // portDataType)
    //portOneDataType = portOneDataType.split(')')[0]; // portDataType

    //var portTwoDataType = toport.portId.split('(')[toport.portId.split('(').length - 1]; // portDataType)
    //portTwoDataType = portTwoDataType.split(')')[0]; // portDataType

    var portOneDataType = fromport.portId.split('.')[fromport.portId.split('.').length - 1];
    var portTwoDataType = toport.portId.split('.')[toport.portId.split('.').length - 1];


    //if(portOneDataType == portTwoDataType)return true; //the linking datatype is same, so allow

    //alert("From Node: => " + fromnode.data.key);
    var fromNode = myDiagram.findNodeForKey(fromnode.data.key);
    var toNode = myDiagram.findNodeForKey(tonode.data.key);

    //(fromNode.data.currentOwner == toNode.data.currentOwner) &&

    //check if this user has the access to both connecting nodes and also matches the datatypes.
    if( (fromNode.data.currentOwner == toNode.data.currentOwner) && (portOneDataType == portTwoDataType) )return true;

    return false;

  }







  // validate if the linking modules have the same (compatible) data type
  myDiagram.toolManager.linkingTool.linkValidation = validateSameDataTypeOfModulesAndNodeAccessibility;



    function makePort(portDataType, portIdentifier, leftside) {
      var port = $$(go.Shape, "Rectangle",
                   {
                     fill: "#FF5733", stroke: null,
                     desiredSize: new go.Size(8, 8),
                     //portId: portDataType,  // declare this object to be a "port"
                     toMaxLinks: 1,  // don't allow more than one link into a port
                     cursor: "pointer"  // show a different cursor to indicate potential link point
                   });

      var lab = $$(go.TextBlock, portIdentifier + ' ('+ portDataType +') ',  // the name of the port
                  { font: "8pt sans-serif", stroke: "black", maxSize: new go.Size(130, 40),margin: 0 });

      var panel =$$(go.Panel, "Horizontal",
                    { margin: new go.Margin(2, 0) });

      // set up the port/panel based on which side of the node it will be on
      if (leftside) {
        port.toSpot = go.Spot.Left;
        port.toLinkable = true;
        port.portId = portIdentifier + '.'+ portDataType;
        port.fill = 'orange';
        lab.margin = new go.Margin(1, 0, 0, 1);
        panel.alignment = go.Spot.TopLeft;
        panel.add(port);
        panel.add(lab);
      } else {
        port.fromSpot = go.Spot.Right;
        port.fromLinkable = true;
        port.portId = portIdentifier+ '.'+ portDataType;
        lab.margin = new go.Margin(1, 1, 0, 0);
        panel.alignment = go.Spot.TopRight;
        panel.add(lab);
        panel.add(port);
      }
      return panel;
    }
        function makeTemplate(typename, icon, background, inports, outports) {
            var node = $$(go.Node, "Spot", {
                contextMenu:     // define a context menu for each node
              $$(go.Adornment, "Vertical",  // that has one button
                $$("ContextMenuButton",
                  $$(go.TextBlock, "Lock This Sub-workflow"),
                  { click: lockSubWorkflow }),
                $$("ContextMenuButton",
                  $$(go.TextBlock, "Unlock This Sub-workflow"),
                  { click: unlockSubWorkflow }),
                $$("ContextMenuButton",
                  $$(go.TextBlock, "Lock Info"),
                  { click: getThisLockInfo })
                // more ContextMenuButtons would go here
              )  // end Adornment
            , copyable:false}, new go.Binding("movable", "allowNodeMovability"), new go.Binding("deletable", "allowNodeDeletion"),
          $$(go.Panel, "Auto",
            { width: 290, height: 130},
            $$(go.Shape, "RoundedRectangle",
              {
                fill: background, stroke: "black", strokeWidth: 2,
                spot1: go.Spot.TopLeft, spot2: go.Spot.BottomRight
              }, new go.Binding("fill", "lockStatus")),
            $$(go.Panel, "Table",
              $$(go.TextBlock,
                {
                  row: 0,
                  margin: 3,
                  maxSize: new go.Size(150, 40),
                  stroke: "black",
                  font: "bold 11pt sans-serif"
                },
                new go.Binding("text", "name").makeTwoWay()),
              $$(go.Picture, icon,
                { row: 1, width: 55, height: 55 }),
                $$(go.TextBlock,
                {
                  row: 2,
                  margin: 3,
                  maxSize: new go.Size(150, NaN),
                  stroke: "black",
                  font: "bold 8pt sans-serif"
                },
                new go.Binding("text", "module_id").makeTwoWay())
            ),
              $$(go.Shape, "Circle",
                { row: 3, fill: "white", strokeWidth: 0, name: "jobStatus", width: 13, height: 13 })
          ),
          $$(go.Panel, "Vertical",
            {
              alignment: go.Spot.Left,
              alignmentFocus: new go.Spot(0, 0.5, -8, 0)
            },
            inports),
          $$(go.Panel, "Vertical",
            {
              alignment: go.Spot.Right,
              alignmentFocus: new go.Spot(1, 0.5, 8, 0)
            },
            outports)
        );
      myDiagram.nodeTemplateMap.add(typename, node);
    }

    makeTemplate("Project","images/55x55.png", "white",
                 [makePort("xml","Potential Clones", true)],
                 [makePort("xml", "XML ",false)]);



    myDiagram.linkTemplate =
      $$(go.Link,
        {
          routing: go.Link.AvoidsNodes, corner: 10,
          relinkableFrom: false, relinkableTo: false, curve: go.Link.JumpGap
        }, new go.Binding("deletable", "allowLinkDeletion"),
        $$(go.Shape, { stroke: "#00bfff", name:"datalink", strokeWidth: 2.5 }),
        $$(go.Shape, { stroke: "#00bfff", name:"datalinkArrow", fill: "#00bfff",  toArrow: "Standard" })
      );

    load();


  // Show the diagram's model in JSON format that the user may edit
  function save() {
    document.getElementById("mySavedModel").value = myDiagram.model.toJson();
    myDiagram.isModified = false;
  }
  function load() {
    myDiagram.model = go.Model.fromJson(document.getElementById("mySavedModel").value);
  }

  function addNewLinkToWorkflowObject(newLinkInformation){
    myDiagram.startTransaction("add link");
    var newlink = { from: newLinkInformation.from, frompid: newLinkInformation.frompid, to: newLinkInformation.to, topid:newLinkInformation.topid};
    myDiagram.model.addLinkData(newlink);
    myDiagram.commitTransaction("add link");
  }


   function workflowObjSelectionMoved(selectionNewLocationInfo){
     myDiagram.startTransaction('selection moved');
     var movedNode = myDiagram.findNodeForKey(selectionNewLocationInfo.key);
     movedNode.location = new go.Point(selectionNewLocationInfo.x, selectionNewLocationInfo.y);
     myDiagram.commitTransaction('selection moved');
   }


   function workflowObjRemoveNode(nodeInfoForRemoval){
     myDiagram.startTransaction('node removed');
     var nodeTargetedForDeletion = myDiagram.findNodeForKey(nodeInfoForRemoval.key);
     myDiagram.remove(nodeTargetedForDeletion);
     myDiagram.commitTransaction('node removed');
   }


    function workflowObjRemoveLink(linkInfoForRemoval){
         var linksTargetedForDeletion = myDiagram.findLinksByExample({ 'from': linkInfoForRemoval.from, 'frompid': linkInfoForRemoval.frompid, 'to': linkInfoForRemoval.to, 'topid':linkInfoForRemoval.topid});

        for (var iter = linksTargetedForDeletion; iter.next(); ) {
            aLink = iter.value;
            myDiagram.startTransaction('link removed');
            myDiagram.remove(aLink);
            myDiagram.commitTransaction('link removed');
        }

    }




  //init();
  // create the Overview and initialize it to show the main Diagram
  var myOverview =
    $$(go.Overview, "myDiagramOverview",
      { observed: myDiagram });
    myOverview.grid.visible = false;


  //turn off undo/redo
  myDiagram.model.undoManager.isEnabled = false;
  //make the diagram read only
  //myDiagram.isReadOnly = true;

  myDiagram.contextMenu =
    $$(go.Adornment, "Vertical",
      // no binding, always visible button:
      $$("ContextMenuButton",
        $$(go.TextBlock, "Toggle Grid View"),
        { click: function(e, obj) {
            myDiagram.grid.visible = !myDiagram.grid.visible;
        } })
    );






//===========================>>>>>>>>>>>>>>>>>>>>>>>>
// Diagram Events Start
//===========================>>>>>>>>>>>>>>>>>>>>>>>>

  //show the corresponding module details on any module click
  //TODO: UNCOMMENT WHEN LOCK DEBUGGING IS DONE
  /*myDiagram.addDiagramListener("ObjectSingleClicked",
      function(e) {
        var part = e.subject.part;
        if (!(part instanceof go.Link)) {
            var clickedModuleID = part.data.key; // Module_1
            //clickedModuleID = clickedModuleID.split('_')[1]; // 1
            $(".module").hide();
            $("#"+clickedModuleID).show();
        }
      }
  );*/


    //show the corresponding module details on any module click
  myDiagram.addDiagramListener("ObjectDoubleClicked",
      function(e) {
        var part = e.subject.part;
        if (!(part instanceof go.Link)) {
            var clickedModuleID = part.data.key; // Module_1
            //clickedModuleID = clickedModuleID.split('_')[1]; // 1
            $(".module").hide();
            $("#"+clickedModuleID).show();

            $("#modal_module_configs").css('display', 'block');
        }
      }
  );







  //remove all corresponding module details on background click
  myDiagram.addDiagramListener("BackgroundSingleClicked",
      function(e) {
        //$(".module").hide();
        $("#modal_module_configs").css('display', 'none');
      }
  );

$(document).on('click', '.close', function(){
    //alert('close clicked');
    $("#modal_module_configs").css('display', 'none');
    $("#myModal").css('display', 'none');
});


  //attempting Workflow Diagram Part (link/node) deletion.
  myDiagram.addDiagramListener("SelectionDeleting",
      function(e) {
        //alert("SelectionDeleting");
        for (var iter = myDiagram.selection.iterator; iter.next(); ) {
            var part = iter.value;
            if (part instanceof go.Node) {
                //alert(part.data.key);
                var nodeInfoForRemoval = {'key':part.data.key};
                //delete operation is only successful if this is the current owner.
                //inform other client if only this user is allowed to
                if(part.data.currentOwner == user_email)
                    notifyAll("workflow_obj_selection_node_delete",nodeInfoForRemoval);
            }
            if (part instanceof go.Link) {
                //alert(part.data.from);
                //alert(part.data.topid);
                 var thisPortInput = part.data.to + '_NO_INPUT_SOURCE_SELECTED_' + part.data.topid;
                 var referenceVariable = part.data.topid.split('.')[part.data.topid.split('.').length - 2];
                 thisPortInput = referenceVariable + '="' + WORKFLOW_OUTPUTS_PATH + THIS_WORKFLOW_NAME + '/' +thisPortInput + '"';

                 $("#"+part.data.to + ' .' + referenceVariable).val(thisPortInput).trigger('change');

                //alert("from data ->" +part.data.from);
                var fromNode = myDiagram.findNodeForKey(part.data.from);
                var toNode = myDiagram.findNodeForKey(part.data.to);


                //alert("Deleting Link... From Owner:" + fromNode.data.currentOwner + " To Owner: " + toNode.data.currentOwner);
                //only allow and send this info in case its current owner (both from/to)...
                if(fromNode.data.currentOwner == user_email && toNode.data.currentOwner == user_email){
                    var linkInfoForRemoval = {'from': part.data.from, 'frompid': part.data.frompid, 'to': part.data.to, 'topid': part.data.topid};
                    notifyAll("workflow_obj_selection_link_delete",linkInfoForRemoval);
                }
            }
        }
      }
  );

  //event called on creating new link on the workflow object
  myDiagram.addDiagramListener("LinkDrawn",
      function(e) {
        var part = e.subject.part;
        if (part instanceof go.Link) {
            //alert("Linked From: "+ part.data.from + " To: " + part.data.to);

            //$("#module_id_1 ."+part.data.topid).val("var='this should be new value'");
            //var toModuleId = part.data.to.split('_')[1]; // ie., x in Module_x
            //toModuleId = '#module_id_'+ toModuleId;

            var toPortClass = part.data.topid.split('.')[part.data.topid.split('.').length - 2];
            //var fromPortClass = part.data.frompid.split('.')[part.data.frompid.split('.').length - 2];
            //toPortClass = ' .' + toPortClass;

            $('#'+part.data.to +' .'+toPortClass).val(toPortClass+"='"+ WORKFLOW_OUTPUTS_PATH + THIS_WORKFLOW_NAME + '/' + part.data.from+'_'+part.data.frompid+"'").trigger('change');


            //alert("To " + part.data.to);
            //alert(part.data.topid.split('(')[part.data.topid.split('(').length - 2]);

            var newLinkInformation = {'from': part.data.from, 'frompid': part.data.frompid, 'to': part.data.to, 'topid': part.data.topid};
            notifyAll("workflow_obj_new_link_drawn", newLinkInformation);

        }
      }
  );

  //event called on selection (Node) changes...
  myDiagram.addDiagramListener("SelectionMoved",
      function(e) {
        //alert("Selection Moved");
        for (var iter = myDiagram.selection.iterator; iter.next(); ) {
            var part = iter.value;
            if (part instanceof go.Node) {
                //alert(part.data.key + " x: " + part.location.x + " y: " + part.location.y);
                var nodeNewLocationInformation = {'key': part.data.key, 'x':part.location.x, 'y':part.location.y};
                notifyAll('workflow_obj_selection_moved', nodeNewLocationInformation);
            }
        }

      }
  );





  function lockSubWorkflow(e, obj) {
    var node = obj.part.adornedPart;  // the Node with the context menu
    //alert("Sub-workflow Lock => " + node.data.currentOwner);

    //update the self state
    onNodeAccessRequest(user_email, node.data.key);



    //inform all other clients of this node access
    var requestInfo ={"nodeID":node.data.key, "requestedBy":user_email};
    notifyAll("node_access_request", requestInfo);



    /*
    // compute and remember the distance of each node from the BEGIN node
    distances = findDistances(node);

    // show the distance on each node
    var it = distances.iterator;
    while (it.next()) {
      var n = it.key;
      var dist = it.value;
      console.log(n.data.key +  " => " +  dist);
      //myDiagram.model.setDataProperty(n.data, "distance", dist);
      if(dist != Infinity){
        myDiagram.startTransaction("changed color");
        myDiagram.model.setDataProperty(n.data, "lockStatus", "lightgreen");
        myDiagram.commitTransaction("changed color");
      }


    }*/

  }


  function unlockSubWorkflow(e, obj) {
        var node_id =  obj.part.adornedPart.data.key;
        if(onNodeAccessRelease(node_id, user_email)==true){
            //inform all other clients of this node release
            var requestInfo ={"nodeID":node_id, "requestedBy":user_email};
            notifyAll("node_access_release", requestInfo);

            //on this event change... try dispatching eligible requests
            dispatchNodeRequests();

        }else{
            alert("Could not Release Child Node Access. Please remove the parent node access First!");
        }

  }



  function getThisLockInfo(e, obj) {
    var node = obj.part.adornedPart;  // the Node with the context menu
    //alert("Lock Info => " + node.data.key);
  }



/*
  myDiagram.model.addChangedListener(function(e) {
    if (e.isTransactionFinished) {

      var tx = e.newValue;
      window.console.log(tx);
      //if (tx instanceof go.Transaction && window.console) {
        //window.console.log(tx.name);
        tx.changes.each(function(c) {
          if (c.model) window.console.log("  " + c.toString());
        });
      //}
    }
  });*/
//===========================>>>>>>>>>>>>>>>>>>>>>>>>
// Diagram Events Ends
//===========================>>>>>>>>>>>>>>>>>>>>>>>>


// Returns a Map of Nodes with distance values from the given source Node.
  // Assumes all links are unidirectional.
  function findDistances(source) {
    var diagram = source.diagram;
    // keep track of distances from the source node
    var distances = new go.Map(go.Node, "number");
    // all nodes start with distance Infinity
    var nit = diagram.nodes;
    while (nit.next()) {
      var n = nit.value;
      distances.add(n, Infinity);
    }
    // the source node starts with distance 0
    distances.add(source, 0);
    // keep track of nodes for which we have set a non-Infinity distance,
    // but which we have not yet finished examining
    var seen = new go.Set(go.Node);
    seen.add(source);

    // keep track of nodes we have finished examining;
    // this avoids unnecessary traversals and helps keep the SEEN collection small
    var finished = new go.Set(go.Node);
    while (seen.count > 0) {
      // look at the unfinished node with the shortest distance so far
      var least = leastNode(seen, distances);
      var leastdist = distances.getValue(least);
      // by the end of this loop we will have finished examining this LEAST node
      seen.remove(least);
      finished.add(least);
      // look at all Links connected with this node
      var it = least.findLinksOutOf();
      while (it.next()) {
        var link = it.value;
        var neighbor = link.getOtherNode(least);
        // skip nodes that we have finished
        if (finished.contains(neighbor)) continue;
        var neighbordist = distances.getValue(neighbor);
        // assume "distance" along a link is unitary, but could be any non-negative number.
        var dist = leastdist + 1;  //Math.sqrt(least.location.distanceSquaredPoint(neighbor.location));
        if (dist < neighbordist) {
          // if haven't seen that node before, add it to the SEEN collection
          if (neighbordist === Infinity) {
            seen.add(neighbor);
          }
          // record the new best distance so far to that node
          distances.add(neighbor, dist);
        }
      }
    }

    return distances;
  }

  // This helper function finds a Node in the given collection that has the smallest distance.
  function leastNode(coll, distances) {
    var bestdist = Infinity;
    var bestnode = null;
    var it = coll.iterator;
    while (it.next()) {
      var n = it.value;
      var dist = distances.getValue(n);
      if (dist < bestdist) {
        bestdist = dist;
        bestnode = n;
      }
    }
    return bestnode;
  }

//========================================================
//================ GO CODES ENDS =========================
//========================================================







































































//========================================================
//============= WORKFLOW CONTROL CODE STARTS =============
//========================================================

  //tree implementation starts

  //node construct
  function Node(data) {
    this.data = data;
    this.parent = null;
    this.isLocked = false;
    this.currentOwner = "NONE";
    this.children = [];
  }

  //tree construct
  function Tree(data) {
    var node = new Node(data);
    this._root = node;
  }

  //traverse the tree by df default starting from the root of the tree
  Tree.prototype.traverseDF = function(callback) {

    // this is a recurse and immediately-invoking function
    (function recurse(currentNode) {
      // step 2
      for (var i = 0, length = currentNode.children.length; i < length; i++) {
        // step 3
        recurse(currentNode.children[i]);
      }

      // step 4
      callback(currentNode);

      // step 1
    })(this._root);

  };

  //traverse by depth first search from a specified start node (parent)
  Tree.prototype.traverseDF_FromNode = function(startNode, callback) {

        // this is a recurse and immediately-invoking function
        (function recurse(currentNode) {
            // step 2
            for (var i = 0, length = currentNode.children.length; i < length; i++) {
                // step 3
                recurse(currentNode.children[i]);
            }

            // step 4
            callback(currentNode);

            // step 1
        })(startNode);

    };

  //scans through all the nodes of the tree
  Tree.prototype.contains = function(callback, traversal) {
    traversal.call(this, callback);

  };

  //add a new node to a specific parent of the tree
  Tree.prototype.add = function(data, toData, traversal) {
    var child = new Node(data),
      parent = null,
      callback = function(node) {
        if (node.data === toData) {
          parent = node;
        }
      };

    this.contains(callback, traversal);

    if (parent) {
      parent.children.push(child);
      child.parent = parent;
    } else {
      throw new Error('Cannot add node to a non-existent parent.');
    }
    //return the newly created node
    return child;
  };

  //change the parent of a node to a new specified parent. the whole subtree (descendants)
  //moves along the node.
  Tree.prototype.changeParent = function(data, newParentData, traversal) {
    var targetNode = null,
    	oldParent = null,
      callback = function(node) {
        if (node.data === data) {
          oldParent = node.parent;
          targetNode = node;
        }
      };

    this.contains(callback, traversal);

    if (oldParent) {
      index = findIndex(oldParent.children, data);

      if (index === undefined) {
        throw new Error('Node to change parents of does not exist.');
      } else {
        nodeToChangeParentOf = oldParent.children.splice(index, 1);

        var newParent = null,
          newParentCallback = function(node) {
            if (node.data === newParentData) {
              newParent = node;
            }
          };

        this.contains(newParentCallback, traversal);

        if (newParent) {
        	newParent.children.push(targetNode);
          targetNode.parent = newParent;
          //alert(newParent.children[0].data);
        } else {
          throw new Error('New Parent Does not exist!');
        }


      }


    } else {
      throw new Error('The node did not have any previous parent!');
    }

  };

  //removes a particular node from its parent.
  Tree.prototype.remove = function(data, fromData, traversal) {
    var tree = this,
      parent = null,
      childToRemove = null,
      index;

    var callback = function(node) {
      if (node.data === fromData) {
        parent = node;
      }
    };

    this.contains(callback, traversal);

    if (parent) {
      index = findIndex(parent.children, data);

      if (index === undefined) {
        throw new Error('Node to remove does not exist.');
      } else {
        childToRemove = parent.children.splice(index, 1);
      }
    } else {
      throw new Error('Parent does not exist.');
    }

    return childToRemove;
  };

  //returns node object, given its node data
  Tree.prototype.getNode = function(nodeData,  traversal) {
    var theNode = null,
        callback = function(node) {
            if (node.data === nodeData) {
                theNode = node;
            }
        };
    this.contains(callback, traversal);

    return theNode;

  }

  //check if the node or any of its descendants are locked currently.
  //if not, the node floor is available as per the client request.
  Tree.prototype.isNodeFloorAvailable = function(nodeData, requestedBy, traversal) {
/*  var theNode = this.getNode(nodeData, traversal);
    if(theNode == null){
        throw new Error('The requested node for access does not exist!');
    }

    //if the node is itself locked, then its NOT available for the requested user
    if(theNode.isLocked == true)return false;

    //if the node itself is not locked, check if any of its children are locked or not
    //if any of them are locked, the access is NOT granted...
    var nodeFloorAvailability = true;
    this.traverseDF_FromNode(theNode, function(node){
        //if any of its descendants are locked currently, the node access is not available
        if(node.isLocked == true)nodeFloorAvailability = false;
    });
*/

    var node = myDiagram.findNodeForKey(nodeData);
    // compute and remember the distance of each node from the BEGIN node
    distances = findDistances(node);

    var nodeFloorAvailability = true;


    // show the distance on each node
    var it = distances.iterator;
    while (it.next()) {
          var n = it.key;
          var dist = it.value;

          //myDiagram.model.setDataProperty(n.data, "distance", dist);
          if(dist != Infinity){
            //myDiagram.startTransaction("changed color");
            //myDiagram.model.setDataProperty(n.data, "lockStatus", "lightgreen");
            //myDiagram.commitTransaction("changed color");

            //if any of the locked node in the subworkflow is not locked by this owner
            //the node floor is not available
            if( (n.data.isLocked == 'True') && (n.data.currentOwner != requestedBy) )nodeFloorAvailability = false;
            //console.log(n.data.key +  " => " +  n.data.currentOwner);
          }
   }

    return nodeFloorAvailability;

  }

  //someone has got the access to this node, so lock it and all its descendants
  Tree.prototype.lockThisNodeAndDescendants = function(newOwner, nodeData,  traversal) {
    /*var theNode = this.getNode(nodeData, traversal);
    this.traverseDF_FromNode(theNode, function(node){
         //use helper function to load this node for the corresponding user
         lockNode(node, newOwner);
    });*/


        var node = myDiagram.findNodeForKey(nodeData);
        // compute and remember the distance of each node from the BEGIN node
        distances = findDistances(node);


        // show the distance on each node
        var it = distances.iterator;
        while (it.next()) {
              var n = it.key;
              var dist = it.value;

               //alert(n.data.key);

              //myDiagram.model.setDataProperty(n.data, "distance", dist);
              if(dist != Infinity){


                    myDiagram.startTransaction("changed color");
                        myDiagram.model.setDataProperty(n.data, "isLocked", "True");
                        myDiagram.model.setDataProperty(n.data, "currentOwner", newOwner);

                        if(newOwner == user_email)myDiagram.model.setDataProperty(n.data, "lockStatus", "lightgreen");
                        else myDiagram.model.setDataProperty(n.data, "lockStatus", "#FFB2B2");
                    myDiagram.commitTransaction("changed color");
              }
        }

  }




  //someone has released the access to this node, so UNLOCK it and all its descendants
  Tree.prototype.unlockThisNodeAndDescendants = function(nodeData,  traversal) {
    var theNode = this.getNode(nodeData, traversal);
    this.traverseDF_FromNode(theNode, function(node){
         //use the helper function to unlock the node.
         unlockNode(node);
    });
  }


  //HELPER FUNCTION: child index
  function findIndex(arr, data) {
    var index;

    for (var i = 0; i < arr.length; i++) {
      if (arr[i].data === data) {
        index = i;
      }
    }

    return index;
  }

  //HELPER FUNCTION: lock a given node with corresponding owner name
  function lockNode(node, nodeOwner){
    node.isLocked = true;
    node.currentOwner = nodeOwner;
  }

  //HELPER FUNCTION: unlock a node
  function unlockNode(node){
    node.isLocked = false;
    node.currentOwner = "NONE";
  }

   //====================
   //tree implementation ends
   //====================





//create parent workflow at the starting
var workflow = new Tree("workflow_root");

//source code in pre tag... toggle show/hide
$(document).on('click', ".code_show_hide", function () {//here
    $(this).siblings('.pre_highlighted_code').children(".highlighted_code").toggle(1000);
});

$(document).on('click', ".documentation_show_hide", function () {//here
    $(this).siblings('.documentation').toggle(300);
});

$(document).on('click', ".settings_show_hide" ,function () {//here
    $(this).siblings('.settings').toggle(300);
});

$(document).on('click', ".btn_edit_code" ,function () {//here
    $(this).siblings('.edit_code').toggle(1000);
});

$(document).on('change', ".setting_param" ,function () {//here
    //alert("Value Changed: =>" + $(this).attr('class') + "<=");
    //var prev_code = $(this).parent().parent().siblings(".setting_section").children(".edit_code").find(".code_settings").val();
    //alert(prev_code);
    //$(this).parent().parent().siblings(".setting_section").children(".edit_code").find(".code_settings").val(prev_code + "\n" + $(this).val());
    $(this).parent().parent().siblings(".setting_section").children(".edit_code").find(".code_settings").val('');
    $(this).siblings(".setting_param").each(function () {
        //alert($(this).val());
        var prev_code = $(this).parent().parent().siblings(".setting_section").children(".edit_code").find(".code_settings").val();
        $(this).parent().parent().siblings(".setting_section").children(".edit_code").find(".code_settings").val("\n"+prev_code + "\n\n" + $(this).val());
    });
    var prev_code = $(this).parent().parent().siblings(".setting_section").children(".edit_code").find(".code_settings").val();
    $(this).parent().parent().siblings(".setting_section").children(".edit_code").find(".code_settings").val("\n"+prev_code + "\n\n" + $(this).val());

    //alert("Change Triggered...!!!");

    //get module id and param information for change in the remote clients
    //var myPar = $(this).closest(".module");
    //alert(myPar.attr('id'));
    //alert($(this).index("#" + myPar.attr('id') + "  .setting_param"));

    //inform of this change to all the other clients...
    //if(isItMyFloor() == true){
    var myParent = $(this).closest(".module");
    var elementInfo = "#" + myParent.attr('id') + "  .setting_param";
    var paramIndex = $(this).index(elementInfo);
    var newParamValue = $(this).val();
    var changeInfo = {"elementInfo": elementInfo, "paramIndex": paramIndex, "newParamValue": newParamValue};
    notifyAll("moduleSettingsChanged", changeInfo);
    //}

});


function onModuleParentChange(moduleID, newParentID, parentIndex){
        //change the view on this client...
        $("#"+moduleID+" .setting_param_parent").eq(parseInt(parentIndex)).val(newParentID);

        //change the object strcuture
        workflow.changeParent(moduleID, newParentID, workflow.traverseDF);

        //redraw the workflow structure based on this update
       // redrawWorkflowStructure();
}


//lock all the param settings for the provided moduleID
function lockParamsSettings(moduleToLock){
    //select all the param settings for the module descendants...
    $("#"+moduleToLock+" .setting_param").prop("disabled", true);
    //alert("disabled");
}


//unlock the param settings of the provided module id
function unlockParamsSettings(moduleToUnlock){
    //select all the param settings for the module descendants...
    $("#"+moduleToUnlock+" .setting_param").prop("disabled", false);
}



//change the request btn state for the use of the client
function changeRequestBtnState(moduleID, newText, isDisabled, isVisible){
    $("#"+moduleID+" .node_floor_req").text(newText);
    $("#"+moduleID+" .node_floor_req").prop('disabled', isDisabled);

    if(isVisible == true)$("#"+moduleID+" .node_floor_req").show();
    else $("#"+moduleID+" .node_floor_req").hide();
}


//this node and its descendants has been locked by other client
//so lock these nodes for this client and also change request btn state for later request by this client
function updateView_lockThisNodeAndDescendants(parentNodeData){
    /*var theNode = workflow.getNode(parentNodeData, workflow.traverseDF);
    workflow.traverseDF_FromNode(theNode, function(node){
          lockParamsSettings(node.data);

          //change node access btn... so he can request the access for the node later
          changeRequestBtnState(node.data, "Request Node Access", false, true);
    });*/


    var node = myDiagram.findNodeForKey(parentNodeData);
    // compute and remember the distance of each node from the BEGIN node
    distances = findDistances(node);

    var nodeFloorAvailability = true;


    // show the distance on each node
    var it = distances.iterator;
    while (it.next()) {
          var n = it.key;
          var dist = it.value;

          //myDiagram.model.setDataProperty(n.data, "distance", dist);
          if(dist != Infinity){
            //alert("@updateView_lockThisNodeAndDescendants");
            myDiagram.startTransaction("nodeReadOnly");
                myDiagram.model.setDataProperty(n.data, "allowNodeMovability", false);
                myDiagram.model.setDataProperty(n.data, "allowNodeDeletion", false);

                var it = n.findLinksOutOf();
                while (it.next()) {
                    var link = it.value;
                    //alert("link data => " + link.data);
                    //alert("link key => " + link.key);
                    myDiagram.model.setDataProperty(link.data, "allowLinkDeletion", false);
                }

            myDiagram.commitTransaction("nodeReadOnly");


            //if any of the locked node in the subworkflow is not locked by this owner
            //the node floor is not available
            //if( (n.data.isLocked == 'True') && (n.data.currentOwner != requestedBy) )nodeFloorAvailability = false;
            //console.log(n.data.key +  " => " +  n.data.currentOwner);
          }
   }



}




//This client has got the access for the node and its descendants
//so unlock the nodes.... and change the request btn state as well
function updateView_unlockThisNodeAndDescendants(parentNodeData){
    var theNode = workflow.getNode(parentNodeData, workflow.traverseDF);
    workflow.traverseDF_FromNode(theNode, function(node){
          unlockParamsSettings(node.data);

          //change node access btn...
          //this client is currently using these nodes... so change state for release node Access
          //hide it for all the children nodes
          changeRequestBtnState(node.data, "Release Node Access", true, false);
    });

    //only for the parent show/able the release node access btn
    changeRequestBtnState(parentNodeData, "Release Node Access", false, true);

}





//adds the module to the pipeline. moduleID is unique throughout the whole pipeline
//moduleName is the name of the module like: rgb2gray, medianFilter and so on
function addModuleToPipeline(whoAdded, moduleID, moduleName){

        var module_name = '';
        var documentation = '';
        var moduleSourceCode_settings = '';
        var moduleSourceCode_main = '';
        var moduleSourceCode_html = '';

        $.ajax({
            type: "POST",
            cache: false,
            url: "/get_module_details",
            data: 'p_module_key=' + moduleName,
            success: function (option) {
                //alert("@ success");
                module_name = option.module_name
                documentation = option.documentation
                moduleSourceCode_settings = option.moduleSourceCode_settings
                moduleSourceCode_main = option.moduleSourceCode_main
                moduleSourceCode_html = option.moduleSourceCode_html
                user_role = option.user_role

                user_role_based_edit = ''
                if (user_role == 'image_researcher') {
                    user_role_based_edit = '| <a style="font-size:12px;color:#000000;" href="#" class="btn_edit_code"> Edit </a> | <a style="font-size:12px;color:#000000;" href="#" > Contact Author </a>';
                }

                //Parse the givn XML for tool definition
                var xmlDoc = $.parseXML( moduleSourceCode_html );
                var $xml_tool_definition = $(xmlDoc);

                //the tool configuration.
                //TODO: add the input port info.
                var tool_configs = $xml_tool_definition.find("toolConfigurations");
                tool_configs = tool_configs.html();



                var tool_documentation = $xml_tool_definition.find("toolDocumentation");
                tool_documentation = tool_documentation.html();


                var ioInformation = '';

                var $toolInput = $xml_tool_definition.find("toolInput");

                $toolInput.each(function(){

                    var label = $(this).find('label').text(),
                        dataFormat = $(this).find('dataFormat').text(),
                        referenceVariable = $(this).find('referenceVariable').text();

                        ioInformation +=  '<input type="text" style="display:none;" class="setting_param module_input '+ referenceVariable + '" ' + ' size="45"/>';


                });


                var $toolOutput = $xml_tool_definition.find("toolOutput");

                $toolOutput.each(function(){

                    var label = $(this).find('label').text(),
                        dataFormat = $(this).find('dataFormat').text(),
                        referenceVariable = $(this).find('referenceVariable').text();

                    //var thisPortOutput = 'module_id_' + moduleID + '_' + referenceVariable+'.' + dataFormat;
                    //var thisPortOutputPath = referenceVariable + '="' + thisPortOutput + '"';

                    ioInformation += '<input type="text" style="display:none;" class="setting_param module_output '+ referenceVariable + '" size="45"/>';


                });







//Parse the givn XML
//var xmlDoc = $.parseXML( xml );

//var $xml = $(xmlDoc);

  // Find Person Tag
//var $person = $xml.find("toolConfigurations");


                //append new module to the pipeline...
                $("#img_processing_screen").append(
                    '<div style="background-color:#EEE;width:100%;" class="module" id="module_id_'+ moduleID +'">' +

                '<!-- Documentation -->' +
                '<div style="margin:10px;font-size:17px;color:#000000;">' +
                  ' ' + module_name +  ' (Module ' + moduleID + ')'+ '<hr/>' +
                   ' Documentation: <a style="font-size:12px;color:#000000;" href="#" class="documentation_show_hide">(Show/Hide)</a>' +
                    '<div class="documentation" style="background-color:#DDDDDD;display:none;font-size:14px;">' + tool_documentation + '</div>' +
                '</div>' +


                '<!-- Settings -->' +
                '<div style="margin:10px;font-size:17px;color:#000000;">' +
                 '   Settings: <a style="font-size:12px;color:#000000;" href="#" class="settings_show_hide">(Show/Hide)</a>' +
                 '   <div class="settings" style="background-color:#DDDDDD;font-size:14px;">' + tool_configs + '<br/>' + ioInformation +
                        '<input type="hidden" class="setting_param " size="45" id="module_id_'+ moduleID +'_output_destination" />'+
                    '</div>' +
                '</div>' +


                '<div style="margin:10px;font-size:17px;color:#000000;" class="setting_section">' +
                '    <a style="display:none;font-size:12px;color:#000000;" href="#" class="code_show_hide">(Show/Hide)</a>' + user_role_based_edit +

                 '   <div class="edit_code" style="background-color:#888888;font-size:14px;display:none;">' +
                  '          <textarea rows=7 cols=150 class="code_settings">' + moduleSourceCode_settings + '</textarea>' +
                   '         <p style="color:#000000;">Main Implementation: </p>' +
                    '        <textarea rows=10 cols=150>' + moduleSourceCode_main + '</textarea>' +
                    '</div>' +

                   ' <pre style="background-color:#333333;width:100%;display:none;" class="pre_highlighted_code">' + '<code class="python highlighted_code" style="display:none;">' + moduleSourceCode_settings +
                   ' ' +
                moduleSourceCode_main + '</code></pre>' +

               ' </div>' +

                '</div>'


            );//end of append




            //if I did not added this module... lock the param settings...
            if(whoAdded != user_email){
                var modID = "module_id_"+moduleID;
                lockParamsSettings(modID);
            }




            $("#module_id_"+ moduleID + "_output_destination").val("output_destination = '/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/test_workflow/Module_" + moduleID + "'").trigger('change');











            var listOfInputPorts = [];
            var listOfOutputPorts = [];



             //input port definition
            var $toolInput = $xml_tool_definition.find("toolInput");

            $toolInput.each(function(){

                var label = $(this).find('label').text(),
                    dataFormat = $(this).find('dataFormat').text(),
                    referenceVariable = $(this).find('referenceVariable').text();

                //$("#ProfileList" ).append('<li>' +label+ ' - ' +dataFormat+ ' - ' + idn +'</li>');

                var aNewInputPort = makePort(dataFormat,referenceVariable,true);
                listOfInputPorts.push(aNewInputPort);



                 var thisPortInput = 'module_id_' + moduleID + '_NO_INPUT_SOURCE_SELECTED_.' + dataFormat;
                 thisPortInput = referenceVariable + '="' + WORKFLOW_OUTPUTS_PATH + THIS_WORKFLOW_NAME + '/' +thisPortInput + '"';

                 $("#module_id_"+moduleID + ' .' + referenceVariable).val(thisPortInput).trigger('change');

            });





             //output port definition
            var $toolOutput = $xml_tool_definition.find("toolOutput");

            $toolOutput.each(function(){

                var label = $(this).find('label').text(),
                    dataFormat = $(this).find('dataFormat').text(),
                    referenceVariable = $(this).find('referenceVariable').text();

                //$("#ProfileList" ).append('<li>' +label+ ' - ' +dataFormat+ ' - ' + idn +'</li>');

                var aNewOutputPort = makePort(dataFormat,referenceVariable,false);
                listOfOutputPorts.push(aNewOutputPort);


                 var thisPortOutput = 'module_id_' + moduleID + '_' + referenceVariable+'.' + dataFormat;
                 thisPortOutput = referenceVariable + '="' + WORKFLOW_OUTPUTS_PATH + THIS_WORKFLOW_NAME + '/' +thisPortOutput + '"';

                 $("#module_id_"+moduleID + ' .' + referenceVariable).val(thisPortOutput).trigger('change');

            });





            makeTemplate(moduleName,"images/55x55.png", "white",
                 listOfInputPorts,
                 listOfOutputPorts);






            //Update the DAG
            //var newWorkflowModule = workflow.add("module_id_"+moduleID, "workflow_root", workflow.traverseDF);
            //newWorkflowModule.nodeName = moduleName;
            //redrawWorkflowStructure();


            //alert("Add");
            myDiagram.startTransaction("add node");
            // have the Model add the node data
            var newnode = {"key":"module_id_" + moduleID, "type":moduleName, "name":moduleName, "module_id": "Module "+moduleID, "isLocked":"True", "currentOwner": whoAdded};
            myDiagram.model.addNodeData(newnode);
            // locate the node initially where the parent node is
            //diagram.findNodeForData(newnode).location = node.location;
            // and then add a link data connecting the original node with the new one
            //var newlink = { from: node.data.key, to: newnode.key };
            //diagram.model.addLinkData(newlink);
            // finish the transaction -- will automatically perform a layout
            myDiagram.commitTransaction("add node");


            var addedNode = myDiagram.findNodeForKey("module_id_" + moduleID);

            myDiagram.startTransaction("change color");
                if(whoAdded == user_email)myDiagram.model.setDataProperty(addedNode.data, "lockStatus", "lightgreen");
                else myDiagram.model.setDataProperty(addedNode.data, "lockStatus", "#FFB2B2");
            myDiagram.commitTransaction("change color");


            if(whoAdded == user_email){
                updateView_unlockThisNodeAndDescendants("module_id_" + moduleID);//unlock for this client
            }else{
                updateView_lockThisNodeAndDescendants("module_id_" + moduleID);//lock this node and its descendants for this client.
            }



            //if(isItMyFloor() == false)lockParamsSettings();

                /*$('pre code').each(function (i, block) {
                    hljs.highlightBlock(block);
                });*/


            },
            error: function (xhr, status, error) {
                alert(xhr.responseText);
            }

        });//end of ajax


}









function getNextUniqueModuleID(){

    return unique_module_id;
}

function updateNextUniqueModuleID(){

    unique_module_id = unique_module_id + 1;
}

//removes a passed request from the waiting queue
//called when someone gets access from the queue
function removeRequestFromQueue(requestInfo){
    for(var i=0;i<nodeAccessRequestsQueue.length; i++){
        if(nodeAccessRequestsQueue[i].nodeID == requestInfo.nodeID && nodeAccessRequestsQueue[i].requestedBy == requestInfo.requestedBy){
            nodeAccessRequestsQueue.splice(i,1);
        }
    }
}


//informs if a request is already in the queue
function isTheRequestAlreadyInQueue(requestInfo){
    for(var i=0;i<nodeAccessRequestsQueue.length; i++){
        if(nodeAccessRequestsQueue[i].nodeID == requestInfo.nodeID && nodeAccessRequestsQueue[i].requestedBy == requestInfo.requestedBy){
            return true;
        }
    }

    return false;
}



//iterate over the node access requests
//and dispatch any node request if possible.
function dispatchNodeRequests(){
    for(var i=0;i<nodeAccessRequestsQueue.length; i++){
        var requestInfo = nodeAccessRequestsQueue[i];

        if(workflow.isNodeFloorAvailable(requestInfo.nodeID, requestInfo.requestedBy, workflow.traverseDF)==true){
            //the node access is now attainable... request to self
            onNodeAccessRequest(requestInfo.requestedBy, requestInfo.nodeID);

            //also inform all other clients
            var reqInfo ={"nodeID":requestInfo.nodeID, "requestedBy":requestInfo.requestedBy};
            notifyAll("node_access_request", reqInfo);
        }
    }
}

//some of the nodes were released
function onNodeAccessRelease(nodeID, releasedBy){
    var theNode = workflow.getNode(nodeID, workflow.traverseDF);
    if(theNode){
        if(theNode.parent.isLocked == true)throw new Error('Could not Release Child Node. Must release the parent node first.!');
        //unlock the node and its descendants....
        workflow.unlockThisNodeAndDescendants(theNode.data, workflow.traverseDF);

        //update the view... lock its view
        updateView_lockThisNodeAndDescendants(nodeID);

        //update the workflow structure view
        //redrawWorkflowStructure();

        //the nodes released successfully.
        return true;

    }else{
        throw new Error('Node does not exist to Release!!!');
    }

    //update the workflow structure view
    //redrawWorkflowStructure();

    return false;
}


//someone requested access to a node
function onNodeAccessRequest(requestedBy, nodeID){

    //if the requested node floor is available, give access to the requester
    if(workflow.isNodeFloorAvailable(nodeID, requestedBy, workflow.traverseDF) == true){
        //alert("Node Access Available...");
        //lock this and all its descendants node for the requested client
        workflow.lockThisNodeAndDescendants(requestedBy, nodeID, workflow.traverseDF);

        //alert("onNodeAccessRequest: " + requestedBy);
        //if this client was the requester, unlock parent and disencedants requested nodes
        if(requestedBy == user_email){
            updateView_unlockThisNodeAndDescendants(nodeID);//unlock for this client
        }else{
            updateView_lockThisNodeAndDescendants(nodeID);//lock this node and its descendants for this client.
        }


        //in case the request was waiting the queue... remove it
        var requestInfo ={"nodeID":nodeID, "requestedBy":requestedBy};
        removeRequestFromQueue(requestInfo);

    }
    //node is not currently accessable (locked by someone else), add the request to the queue
    else{
        var requestInfo ={"nodeID":nodeID, "requestedBy":requestedBy};
        //push the request to the queue if does not already exist in the queue
        if(isTheRequestAlreadyInQueue(requestInfo) == false){
            nodeAccessRequestsQueue.push(requestInfo);
        }

    }

    //update the workflow structure view
    //redrawWorkflowStructure();
}


/*
$(".node_floor_req").live("click", function(){
    var myPar = $(this).closest(".module");
    var node_id = myPar.attr('id');

    if($(this).text() == "Request Node Access"){
        $(this).prop('disabled', true);
        $(this).text("Requested");


        //update the self state
        onNodeAccessRequest(user_email, node_id);



        //inform all other clients of this node access
        var requestInfo ={"nodeID":node_id, "requestedBy":user_email};
        notifyAll("node_access_request", requestInfo);



    }
    else if($(this).text() == "Release Node Access"){
        if(onNodeAccessRelease(node_id, user_email)==true){
            //inform all other clients of this node release
            var requestInfo ={"nodeID":node_id, "requestedBy":user_email};
            notifyAll("node_access_release", requestInfo);

            //on this event change... try dispatching eligible requests
            dispatchNodeRequests();

        }else{
            alert("Could not Release Child Node Access. Please remove the parent node access First!");
        }


    }else{
        throw new Error("Error Requesting Node Access!");
    }




});
*/

//this function is invoked on new module addition request
function onWorkflowModuleAdditionRequest(whoAdded, moduleID, moduleName){

    if(getNextUniqueModuleID() != moduleID){
        throw new Error('Synchronization Problem. Module IDs are not consistent over the network !!!');
    }else{
        //if synchronization is ok... add this node to the workflow
        addModuleToPipeline(whoAdded,moduleID, moduleName);

        //add the node to the workflow tree, default parent is 'workflow_root'
        var addedNode = workflow.add("module_id_"+moduleID, "workflow_root", workflow.traverseDF);
        //by default the newly added node/module is locked by its creater (unless he releases it)
        lockNode(addedNode, whoAdded);


        //prepare the next valid unique module id
        updateNextUniqueModuleID();

        //finally redraw the workflow structure (tree view)
        //redrawWorkflowStructure();
    }
}




$(document).on("click", ".pipeline_modules" ,function(){
        //alert("New Module");
        var newModuleID = getNextUniqueModuleID();
        var newModuleName = $(this).attr("id"); //'biodatacleaning';

        //add the module to self...
        onWorkflowModuleAdditionRequest(user_email, newModuleID, newModuleName);


        //add the module to all remote clients as well...
        var moduleInfo = {"whoAdded":user_email, "newModuleID": newModuleID, "newModuleName": newModuleName};
        notifyAll("remote_module_addition", moduleInfo);


});








//========================================================
//============= WORKFLOW CONTROL CODE ENDS ===============
//========================================================






















});
