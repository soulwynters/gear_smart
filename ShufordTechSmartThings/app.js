//minimum smartapp version for functions to work correctly.
var SMARTAPP_VERSION = "1.0.1";

//smarterauth connector api - if you are a developer, request an access token to - venumx@live.com
var SC_API_KEY = "";

//Page Views
var MainPageRan = false;
var SwitchPageRan = false;
var RoutinesPageRan = false;
var setupPageRan = false;

var pollInterval;

//brightness vars - these need to be global to be accessible in all required methods
var brightnessBarWidget;
var brightnessPage = document.getElementById("brightnessPage");
var lastBrightness = -1;
var setBright;
var changeBright;

//Polling interval in ms for token
var pollingInt = 10000;

//Encrypt Key
var EncryptKey = 2092342;

//Databases

//real
var Access_Token = Decrypt(localStorage.getItem("token_DB"));
var Access_Url = Decrypt(localStorage.getItem("AccessUrl_DB"));

var switches_DB = localStorage.getItem("switches_DB");
var routines_DB = localStorage.getItem("routines_DB");
var locks_DB = localStorage.getItem("locks_DB");

//TAU UI Helpers (to create/destroy)
var SwitchList_UI = null;
var LockList_UI = null;
var RoutineList_UI = null;

//------------------------------------------------------------------------------------Start On Page Changes

//we are on a new page
document.addEventListener("pageshow", function (e) {
	//lets make sure we have internet before things get too serious
	CheckInternet();
	
	//which page are we going to
	var page = e.target.id;
	var pageTarget = e.target;
	
	//what page are we on? run the method for that page -- changed to switch for readability
	switch(page)
	{
		case "mainPage":
			MainPage();
			break;
		case "switchesPage":
			SwitchPage();
			break;
		case "routinesPage":
			RoutinesPage();
			break;
		case "setupPage":
			SetupPage();
			break;
		case "locksPage":
			LockPage();
			break;
		case "processingPage":
			break;
		case "brightnessPage":
			BrightnessPage();
			break;
		default:
			alert("How did this even happen?? Restart the app.");
			tizen.application.getCurrentApplication().exit();
	}
});

//before we hide the page
document.addEventListener( "pagebeforehide", function(e) {
	//get the current page before we hide it
	var page = e.target.id;
	
	//destroy our routine / switch list if we are coming from those pages. -- changed to switch for readability
	switch(page)
	{
		case "routinesPage":
			if(RoutineList_UI) RoutineList_UI.destroy();
			break;
		case "switchesPage":
			if(SwitchList_UI) SwitchList_UI.destroy();
			clearInterval(pollInterval);
			break;
		case "locksPage":
			if(LockList_UI) LockList_UI.destroy();
			clearInterval(pollInterval);
			break;
		case "brightnessPage":
			//reset last brightness
			lastBrightness = -1;
			
			var brightnessSet = document.getElementById('brightnessSet');

			//remove event listeners for brightness
			brightnessSet.removeEventListener("click", setBright);
			window.removeEventListener("rotarydetent", changeBright);
			
			/* Release object */
			brightnessBarWidget.destroy();
			break;
		default:
			//do nothing
	}
});
//------------------------------------------------------------------------------------End On Page Changes

//------------------------------------------------------------------------------------Start Setup Page
function SetupPage(){
	CheckInternet();
	
	//bug: this runs twice? lets account for that.
	if(setupPageRan)
		return;
	
	//setup has run
	setupPageRan = true;
	
	//keep the screen on for the user to enter the token
	tizen.power.request("SCREEN", "SCREEN_NORMAL");
	
	//give auth_code a default value
	var auth_code = -1;
	
	//get the pairing code from api endpoint
	$.ajax({
		url: "https://www.timothyfenton.com/stconnector/api/v1/authentries/create",
		type: "POST",
		data: { },
		headers: {
		    "Authorization": "Token " + SC_API_KEY
		  },
		success: function(json){
			//assign it to the local variable
			auth_code = json.AuthID;
			
			//display it for user to see
			$('#smarterauthtoken').html(auth_code);
			
			//if the auth code was set, lets start polling for result
			if(auth_code !== -1){
				getStatus(auth_code);
			}else{
				alert("could not retrieve auth code from server");
			}
			
		},
		error: function(e)
		{
			errorHandling(e, "server error ocurred, please contact venumx@live.com");
		}
	});
}
//------------------------------------------------------------------------------------End Setup Page

//------------------------------------------------------------------------------------Start Main Page
function MainPage(){
	//is the access token set?
	if(Access_Token){
		//do we have the right smartapp version?
		CheckSmartAppVersion();
		//has the user been here before?
		if(MainPageRan === false){
			//he has now.
			MainPageRan=true;
		}else{	
			//hes been here
		}
	}else{
		//lets try again?
		Access_Token = Decrypt(localStorage.getItem("token_DB"));
		
		if(!Access_Token){	
			//access token is not set. 
			tau.changePage("setupPage");
		}else{
			//do we have the right smartapp version?
			CheckSmartAppVersion();
		}
	}
}
(function(tau) {
	var mPage = document.getElementById("mainPage"),
		selector = document.getElementById("selector"),
		selectorComponent,
		clickBound;
	
	//click event handler for the selector
	function onClick(event) {
		//console.log(event);		
		var target = event.target;
		if (target.classList.contains("ui-selector-indicator")) {
			
			var ItemClicked = event.srcElement.textContent;

			//react to the item clicked -- changed to switch for readability
			switch(ItemClicked)
			{
				case "Switches":
					//move to the switches page
					tau.changePage("switchesPage");
					break;
				case "Routines":
					//move to the routines page
					tau.changePage("routinesPage");
					break;
				case "Locks":
					//move to the locks page
					tau.changePage("locksPage");
					break;					
				case "Clean Database":
					//clear the db - moved to it's own function
					CleanDatabase();
					break;
				case "Logout":
					//logout - based on the old clear database
					Logout();
					break;
				default:
					alert("This feature is not yet implemented. Stay tuned.");
					//do nothing
			}
			
			return;
		}
	}
	//pagebeforeshow event handler - add the click listener
	mPage.addEventListener("pagebeforeshow", function() {
		clickBound = onClick.bind(null);
		selectorComponent = tau.widget.Selector(selector);
		selector.addEventListener("click", clickBound, false);
	});
	//pagebeforehide event handler - get rid of the click listener
	mPage.addEventListener("pagebeforehide", function() {
		selector.removeEventListener("click", clickBound, false);
		selectorComponent.destroy();
	});
}(window.tau));
//------------------------------------------------------------------------------------End Main Page

//------------------------------------------------------------------------------------Start Switch Page
function SwitchPage(){	
	$.when(SwitchPageGetData()).done(function() {
		SwitchPage_Buttons();
	});
}

function SwitchPageGetData(){
	
	//Clear Switches
	$('#Switches').html('');
	
	//We have switch data stored!
	if(switches_DB !== null){ 
		try {
			
			//get the switches
			for(var i=0; i< Object.keys(switches_DB).length; i++){
				
				var element = switches_DB[Object.keys(switches_DB)[i]];
				
				var id = element.id;
				var label = element.label;
				var value = element.value;
				var type = element.type;	
				var level = element.level;
				var checked = "";
				
				if(value == "on"){ checked = "checked"; }	
				
				$('#Switches').append('\
					<li class="li-has-checkbox">\
						<div class="ui-marquee ui-marquee-gradient marquee switch-label">'+label+'</div>\
						<input class="aswitch" deviceid="'+id+'" levelvalue="'+level+'" type="checkbox" ' + checked + '/>\
						<div class="ui-processing" style="display:none;"></div>\
					</li>\
				');
			}

			//fancy GUI stuff
			var switcherr = document.getElementById("Switches");
			SwitchList_UI = tau.helper.SnapListMarqueeStyle.create(switcherr, {
				marqueeDelay: 0,
				marqueeStyle: "endToEnd"
			});
			
			pollInterval = setInterval(pollSwitches, 5000);
			
		} catch (e) {
			//some error happened, invalid json stored?
			alert("There was an error! The database may be corrupted, try clearning it.");
			console.log(e);
			return;
		}
	}
	else
	{ 
		//We couldn't find the switches database data, so lets build it.
		
		//set the processing message and redirect to processing page
		$('#ProcessingMsg').html('Retrieving Switches From SmartThings');
		tau.changePage("processingPage");
		
		updateSwitchStatus(false);
	}
}

function SwitchPage_Buttons()
{	
	$(".switch-label").click(function(){
		//what switch
		var parent = $(this).closest('li');
		
		var WhatSwitch = parent.find('.aswitch');
		
		//get url safe deviceid var
		var DeviceID = encodeURIComponent(WhatSwitch.attr('deviceid'));
		var DeviceLevel = encodeURIComponent(WhatSwitch.attr('levelvalue'));

		if(DeviceLevel != null && DeviceLevel != "null")
		{
			$('#brightnessValue').html(DeviceLevel + "%");
			$('#brightDeviceID').val(DeviceID);
			$('#brightnessBar').val(DeviceLevel);
			
			tau.changePage('brightnessPage');
		}else{
			alert("This device does not support dimming.");
		}
	});

	//user pressed a switch
	$(".aswitch").change(function(){
		
		//set the switch
		var WhatSwitch = this;
		
		//hide the switch, show processing
		$(WhatSwitch).hide();
		$(WhatSwitch).parent().find('.ui-processing').show();
		
		//get url safe deviceid var
		var DeviceID = encodeURIComponent($(WhatSwitch).attr('deviceid'));
		
		//was the switch turning on or off?
		if($(this).is(":checked")) {
			//turning on
			$.get({
			    url: Access_Url + "/switches/" + DeviceID + "/on",
			    beforeSend: function(xhr) { 
			      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
			    },
			    success: function (data) {
			    	//update switch database
			    	updateDeviceDB(DeviceID, data.status, "switches_DB");
			    	
			    	//show the switch again
					$(WhatSwitch).show();
					$(WhatSwitch).parent().find('.ui-processing').hide();
			    },
			    error: function(e){
			    	//handle that error
			    	errorHandling(e, "There was a problem, could not turn on the device!");
			    	
			    	//show the switch again, get rid of the processing
					$(WhatSwitch).show();
					$(WhatSwitch).parent().find('.ui-processing').hide();
			    }
			});
		}else{
			//turn it off
			$.get({
			    url: Access_Url + "/switches/" + DeviceID + "/off",
			    beforeSend: function(xhr) { 
			      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
			    },
			    success: function (data) {
			    	//update switch database
			    	updateDeviceDB(DeviceID, data.status, "switches_DB");
			    	
			    	//show switch, hide processing
					$(WhatSwitch).show();
					$(WhatSwitch).parent().find('.ui-processing').hide();
			    },
			    error: function(e){
			    	//handle that error
			    	errorHandling(e, "There was a problem, could not turn off the device!");
			    	
			    	//show the switch, hide the processing
					$(WhatSwitch).show();
					$(WhatSwitch).parent().find('.ui-processing').hide();
			    }
			});
		}
	});	
}
//------------------------------------------------------------------------------------End Switch Page

//------------------------------------------------------------------------------------Start Brightness Page

function BrightnessPage ()
{
	var brightnessBar = document.getElementById("brightnessBar");
	/* Make Circle Progressbar object */
	brightnessBarWidget = new tau.widget.CircleProgressBar(brightnessBar, {size: "full"});
	
	var brightnessSwitchID = document.getElementById("brightDeviceID"),
		brightnessSet = document.getElementById('brightnessSet');
	
	lastBrightness = brightnessBarWidget.value();
	
	brightnessSet.addEventListener("click", setBright = function(){ setBrightness(brightnessBarWidget.value(), brightnessSwitchID.value); });
	
	window.addEventListener("rotarydetent", changeBright = function(ev){ rotaryBrightness(ev.detail.direction, brightnessBarWidget) });

}

//------------------------------------------------------------------------------------End Brightness Page

//------------------------------------------------------------------------------------Start Routines Page
function RoutinesPage(){
	//did the routines page already run?
	if(RoutinesPageRan === true){	
		//we've been here already,  shouldn't we just be refreshing?
		$.when(RoutinesPageGetData()).done(function() {
			//we got the routine data, let's populate the buttons
			RoutinePage_Buttons();
			//tau.widget.getInstance('Routines').refresh();
		});
	}else{
		//we havent been here before, let's build stuff
		RoutinesPageRan = true;
		//we got the routine data, let's populate the buttons
		$.when(RoutinesPageGetData()).done(function() {
			RoutinePage_Buttons();
			//tau.widget.getInstance('Routines').refresh();
		});
	}
}

function RoutinesPageGetData(){
	//Clear Routines HTML
	$('#Routines').html(''); 
	
	//We have routine data stored!
	if(routines_DB !== null){ 
		
		try{
			//lets get the json object for the routines
			var obj = jQuery.parseJSON(routines_DB);
			
			//build out the routines HTML structure 
			$.each(obj, function(index, element){
				$('#Routines').append('\
					<li class="">\
						<div element="'+element+'" class="aRoutine ui-marquee ui-marquee-gradient">'+element+'</div>\
						<div class="ui-processing" style="display:none;"></div>\
					</li>\
				');
			});
			
			//lets add a button to refresh the routine data
			$('#Routines').append('\
				<li class="">\
					<div id="RefreshRoutineData" class="ui-marquee ui-marquee-gradient">Refresh Data</div>\
				</li>\
			');
			
			//gui stuff
			var switcherr = document.getElementById("Routines");
			
			RoutineList_UI = tau.helper.SnapListMarqueeStyle.create(switcherr, {
				marqueeDelay: 0,
				marqueeStyle: "endToEnd"
			});
		}
		catch (e){
			//oh no an error
			alert("There was an error! The database may be corrupted, try clearing it.");
			
			//shouldn't we retun them to the main page?
			tau.changePage("mainPage");
			return;
		}
		
	}else{ 
		//We couldn't find the routine database data, so lets build it.
		
		//Update the Processing message
		$('#ProcessingMsg').html('Retrieving Routines From SmartThings');
		
		//Go to processing page 
		tau.changePage("processingPage");
		
		//get the routines
		$.get({
		    url: Access_Url + "/routines",
		    beforeSend: function(xhr) { 
		      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
		    },
		    success: function (data) {
		    	//convert the json object to string
		    	data = JSON.stringify(data);
		    	//add the routine data to the DB
				localStorage.setItem("routines_DB", data); 
				//store the routines in the global variable for routines
				routines_DB = data;
				//go to the routines page
		        tau.changePage("routinesPage");
		    },
		    error: function(e){
		    	//handle the error
		    	errorHandling(e, "There was an error getting the routines from SmartThings.");
				
				//lets go back to the routines page
		    	tau.changePage("routinesPage");
		    }
		});
	}
}

function RoutinePage_Buttons(){
	//someone clicked the refresh routine button
	$('#RefreshRoutineData').click(function(){
		//clear out the old stuff
		localStorage.setItem("routines_DB", null);
		routines_DB = null;
		$('#Routines').html('');
		
		//set the processing message then forward to the processing page
		$('#ProcessingMsg').html('Retrieving Routines From SmartThings');
		tau.changePage("processingPage");
		
		//wait 2 seconds, then go back to routines page ?? why??
		setTimeout(function(){ tau.changePage("routinesPage"); }, 2000);
	});
	
	//someone clicked the routine button
	$(".aRoutine").click(function(){
		
		//figure out what routine it is
		var WhatRoutine = this;
		
		//hide the button 
		$(WhatRoutine).hide();
		
		//show switch is processing
		$(WhatRoutine).parent().find('.ui-processing').show();
		
		//get the name of the URL-safe name of the routine
		var RoutineName = encodeURIComponent($(WhatRoutine).attr('element'));
		
		//send a get request to the routine to trigger it
		$.get({
		    url: Access_Url + "/routines/" + RoutineName,
		    beforeSend: function(xhr) { 
		      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
		    },
		    success: function (data) {
		    	//get the data in string format
		    	data = JSON.stringify(data);
		    	//bring back the button
				$(WhatRoutine).show();
				// change back to the button instead and hide the processing
				$(WhatRoutine).parent().find('.ui-processing').hide();
		    },
		    error: function(e){
		    	//handle the error
		    	errorHandling(e, "There was an error triggering your Routine from Smartthings.");
		    	
		    	//show the routine buton again
				$(WhatRoutine).show();
				
				// hide the processing on button
				$(WhatRoutine).parent().find('.ui-processing').hide();
		    }
		});
	});
}
//------------------------------------------------------------------------------------End Routines Page





//------------------------------------------------------------------------------------Start Switch Page
function LockPage(){	
	$.when(LockPageGetData()).done(function() {
		LockPage_Buttons();						
	});
}

function LockPageGetData(){
	
	//Clear Switches
	$('#Locks').html('');
	
	//We have switch data stored!
	if(locks_DB !== null){ 
		try {
			//get the switches
			for(var i=0; i< Object.keys(locks_DB).length; i++){
				
				var element = locks_DB[Object.keys(locks_DB)[i]];
				
				var id = element.id;
				var label = element.label;
				var value = element.value;
				var type = element.type;	
				var checked = "";
				
				if(value == "locked"){ checked = "checked"; }	
				
				$('#Locks').append('\
					<li class="li-has-checkbox">\
						<div class="ui-marquee ui-marquee-gradient marquee switch-label">'+label+'</div>\
						<input class="alock" deviceid="'+id+'"  type="checkbox" ' + checked + '/>\
						<div class="ui-processing" style="display:none;"></div>\
					</li>\
				');
			}

			//fancy GUI stuff
			var lockerr = document.getElementById("Locks");
			LockList_UI = tau.helper.SnapListMarqueeStyle.create(lockerr, {
				marqueeDelay: 0,
				marqueeStyle: "endToEnd"
			});
			pollInterval = setInterval(pollLocks, 5000);
			
		} catch (e) {
			//some error happened, invalid json stored?
			alert("There was an error! The database may be corrupted, try clearning it.");
			console.log(e);
			return;
		}
	}
	else
	{ 
		//We couldn't find the switches database data, so lets build it.
		
		//set the processing message and redirect to processing page
		$('#ProcessingMsg').html('Retrieving Locks From SmartThings');
		tau.changePage("processingPage");
		
		updateLockStatus(false);
		
	}
}

function LockPage_Buttons()
{	
	//user pressed a switch
	$(".alock").change(function(){
		
		//set the switch
		var WhatLock = this;
		
		//hide the switch, show processing
		$(WhatLock).hide();
		$(WhatLock).parent().find('.ui-processing').show();
		
		//get url safe deviceid var
		var DeviceID = encodeURIComponent($(WhatLock).attr('deviceid'));
		
		//was the switch turning on or off?
		if($(this).is(":checked")) {
			//lock  the door
			$.get({
			    url: Access_Url + "/locks/" + DeviceID + "/lock",
			    beforeSend: function(xhr) { 
			      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
			    },
			    success: function (data) {
			    	//update lock database
			    	updateDeviceDB(DeviceID, data.status, "locks_DB");
			    	
			    	//show the switch again
					$(WhatLock).show();
					$(WhatLock).parent().find('.ui-processing').hide();
			    },
			    error: function(e){
			    	//handle that error
			    	errorHandling(e, "There was a problem, could not lock the device!");
			    	
			    	//show the switch again, get rid of the processing
					$(WhatLock).show();
					$(WhatLock).parent().find('.ui-processing').hide();
			    }
			});
		}else{
			//turn it off
			$.get({
			    url: Access_Url + "/locks/" + DeviceID + "/unlock",
			    beforeSend: function(xhr) { 
			      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
			    },
			    success: function (data) {
			    	//update lock database
			    	updateDeviceDB(DeviceID, data.status, "locks_DB");
			    	
			    	//show switch, hide processing
					$(WhatLock).show();
					$(WhatLock).parent().find('.ui-processing').hide();
			    },
			    error: function(e){
			    	//handle that error
			    	errorHandling(e, "There was a problem, could not unlock the device!");
			    	
			    	//show the switch, hide the processing
					$(WhatLock).show();
					$(WhatLock).parent().find('.ui-processing').hide();
			    }
			});
		}
	});	
}
//------------------------------------------------------------------------------------End Lock Page


//-----------------------------------------HANDLERS----------------------------------------------//

//------------------------------------------------------------------------------------App's Back Button Handler
window.addEventListener( 'tizenhwkey', function( ev ){
	//get the active page
	var page = document.getElementsByClassName('ui-page-active')[0];
	
	//set pageid based on the results from page
	var pageid = page ? page.id : "";
	
	//if the back key was pushed
	if(ev.keyName === "back") {
		//switch on page id - changed to switch for readability
		switch(pageid)
		{
			//if it's main page or setup page, just exit - if not lets go back to mainpage.
			case "mainPage":
			case "setupPage":
				tizen.application.getCurrentApplication().exit();
				break;
			case "brightnessPage":
				tau.changePage("switchesPage");
				break;
			default:
				tau.changePage("mainPage");
		}
	}
});

function setBrightness(level, switchid)
{
	if(level != lastBrightness)
	{
		//set the brightness
		$.get({
		    url: Access_Url + "/switches/" + switchid + "/level/" + level,
		    beforeSend: function(xhr) { 
		      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
		    },
		    success: function (data) {
		    	//let the user know it's done
		    	lastBrightness = level;
		    	updateBrightnessDB(switchid, level, "switches_DB")
		    	alert("Brightness set to " + level + "%!");
		    },
		    error: function(e){
		    	//handle that error
		    	errorHandling(e, "There was a problem, could not adjust brightness!");
		    }
		});
	}
}

function rotaryBrightness(direction, widget) {
	
	//get the display element for brightness
	var brDispVal = document.getElementById("brightnessValue");
	
	//if we are going clockwise, increase, else decrease
	if(direction === "CW"){
		if(widget.value() < 100)
			widget.value(parseInt(widget.value())+2);
	} else {
		if(widget.value() > 0)
			widget.value(parseInt(widget.value())-2);
	}
	
	//update the display of brightness no matter what.
	brDispVal.innerHTML = widget.value() + "%";
}
//------------------------------------------------------------------------------------App's Back Button Handler

//-----------------------------------------HELPER FUNCTIONS-------------------------------------------//

//------------------------------------------------------------------------------------Poll for Status of Auth
function getStatus(auth_id)
{
	//do we have internet???
	CheckInternet();
	
	//lets poll for status on our authentication
	$.ajax({
		url: "https://timothyfenton.com/stconnector/api/v1/authentries/getstatus",
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify({AuthID:auth_id}),
		headers: {
		    "Authorization": "Token 98b7d003-4701-40fb-8295-b2dded696f26"
		  },
		retryLimit: 30,
		success: function(json){
			//set the token and accessurl in the DB
			localStorage.setItem("token_DB", Encrypt(json.AuthToken));
			localStorage.setItem("AccessUrl_DB", Encrypt(json.AuthURL));
			
			//set the global variables to the authtoken  and url
			Access_Token = json.AuthToken;
			Access_Url = json.AuthURL;
			
			//we dont need the screen on all the time anymore, let's release the screen resource
			tizen.power.release("SCREEN");
			
			//let's just try this
			alert("Congratulations! Setup is complete.");
			tau.changePage("mainPage");
			
			//alert('Setup Complete! App will now close, please restart it!');
			//tizen.application.getCurrentApplication().exit();
		},
		error: function(xhr, textStatus, errorThrown)
		{
			//if we reported a 400 this means auth is not ready yet, try again in 20 seconds
			if(xhr.status == '400'){
			    setTimeout( function(){ getStatus(auth_id); }, pollingInt );
			}
		}
	});
}

//------------------------------------------------------------------------------------End Poll for Status of Auth

//------------------------------------------------------------------------------------Start Poll Switch Status'

function pollSwitches()
{
	updateSwitchStatus(true);
}

//------------------------------------------------------------------------------------End Poll for Switch Status

//------------------------------------------------------------------------------------Start Update Switch Status'

function updateSwitchStatus(refresh)
{
	//get those switches
	$.get({
	    url: Access_Url + "/switches",
	    beforeSend: function(xhr) { 
	      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
	    },
	    success: function (data) {
	    	//get the response as a string and send to the database
	    	var switch_data = [];
	    	
	    	var somethingChanged = false;
	    	var statusChanged = false;
	    	var levelChanged = false;
	    	
	    	for(var i = 0; i < data.length; i++)
    		{
	    		switch_data[data[i].id] = new Object();
	    		switch_data[data[i].id].id = data[i].id;
	    		switch_data[data[i].id].label = data[i].label;
	    		switch_data[data[i].id].value = data[i].value;
	    		switch_data[data[i].id].type = data[i].type;
	    		switch_data[data[i].id].level = data[i].level;
	    		
	    		if(refresh && switches_DB != null)
    			{
	    			statusChanged = switch_data[data[i].id].value != switches_DB[data[i].id].value;
	    			levelChanged = switch_data[data[i].id].level != switches_DB[data[i].id].level;
	    			
	    			if(statusChanged || levelChanged)
	    			{
		    			var checked = "";
						
						if(switch_data[data[i].id].value == "on"){ checked = "checked"; }	
						
						$("#Switches li input[deviceid='" + data[i].id + "']").attr('levelvalue', switch_data[data[i].id].level);
						$("#Switches li input[deviceid='" + data[i].id + "']").prop('checked', checked);
						
						somethingChanged = true;
	    			}
    			}
    		}
	    	
	    	if(!refresh || (refresh && somethingChanged))
    		{
	    		localStorage.setItem("switches_DB", switch_data);
	    		//lets get the json version stored in our global switches var
				switches_DB = switch_data;
				
				//we can go to the switches page now
				tau.changePage("switchesPage");
    		}
			
	    },
	    error: function(e){
	    	//handle the errors
	    	errorHandling(e, "There was an error getting your Switches from Smartthings.");
	    	tau.changePage("mainPage");
	    }
	});
}

function pollLocks()
{
	updateLockStatus(true);
}


//------------------------------------------------------------------------------------Start Update Switch Status'

function updateLockStatus(refresh) 
{
	//get those switches
	$.get({
	    url: Access_Url + "/locks",
	    beforeSend: function(xhr) { 
	      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
	    },
	    success: function (data) {
	    	if(Object.keys(data).length !== 0)
	    	{
		    	var lock_data = [];

		    	var somethingChanged = false;
		    	var statusChanged = false;
		    	
		    	for(var i = 0; i < data.length; i++)
	    		{
		    		lock_data[data[i].id] = new Object();
		    		lock_data[data[i].id].id = data[i].id;
		    		lock_data[data[i].id].label = data[i].label;
		    		lock_data[data[i].id].value = data[i].value;
		    		lock_data[data[i].id].type = data[i].type;
		    		
		    		if(refresh && locks_DB != null)
	    			{
		    			statusChanged = lock_data[data[i].id].value != locks_DB[data[i].id].value;
		    			
		    			if(statusChanged)
		    			{
			    			var checked = "";
							
							if(lock_data[data[i].id].value == "locked"){ checked = "checked"; }
							$("#Locks li input[deviceid='" + data[i].id + "']").prop('checked', checked);
							
							somethingChanged = true;
		    			}
	    			}
	    		}
		    	
		    	if(!refresh || (refresh && somethingChanged))
	    		{
		    		localStorage.setItem("locks_DB", lock_data);
		    		//lets get the json version stored in our global switches var
		    		locks_DB = lock_data;

		    		tau.changePage("locksPage");
	    		}
	    	}else{
	    		//no locks found
	    		alert("No locks found, make sure you have allowed your locks in the SmartApp.");
	    		//go back to main page
		    	tau.changePage("mainPage");
	    	}
	    },
	    error: function(e){
	    	//handle the errors
	    	errorHandling(e, "There was an error getting your Switches from Smartthings.");
			
	    	//go back to main page
	    	
	    }
	});
}

//------------------------------------------------------------------------------------Start Update SwitchDB

function updateDeviceDB(switchId, status, dbToUpdate)
{
	window[dbToUpdate][switchId].value = status;
	localStorage.setItem(dbToUpdate, window[dbToUpdate]);
	
}

//------------------------------------------------------------------------------------Start Update SwitchDB

//------------------------------------------------------------------------------------Start Update DB Brightness

function updateBrightnessDB(switchId, level, dbToUpdate)
{
	window[dbToUpdate][switchId].level = level;
	localStorage.setItem(dbToUpdate, window[dbToUpdate]);
}

//------------------------------------------------------------------------------------Start Update Db Brightness


//------------------------------------------------------------------------------------Start Error Handling
function errorHandling(e, errorMsg)
{
	//get the response back from error
	var Response = e.responseText;
	
	try {
		//try to get the error message data as a json object
		var obj = jQuery.parseJSON(Response);
		
		//output as much detail about the error as possible or just tell them there was a problem
		if(obj.message){
	  		alert(obj.message);
	  	}else if(obj.error){
	  		alert(obj.error);
	  	}else{
	  		alert(errorMsg);
	  	}
	} catch (e) {
		//we give up, an error getting details about another error?? just tell them there was an error
		alert(errorMsg);
	}
}
//------------------------------------------------------------------------------------End Error Handling

//------------------------------------------------------------------------------------Start Check Internet Status
function CheckInternet()
{
	if(navigator.onLine === false)
	{
		//Maybe this should be done each time before an api call is fired incase we lose connection after starting the app..
		//If so, move isOnline = navigator.onLine also
		alert('No internet connection, please connect first.');
		tizen.application.getCurrentApplication().exit();
	}
}
//------------------------------------------------------------------------------------End Check Internet Status

//------------------------------------------------------------------------------------Start Check SmartApp Version

//lock  the door
function CheckSmartAppVersion()
{
	$.get({
	  url: Access_Url + "/version",
	  beforeSend: function(xhr) { 
	    xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
	  },
	  success: function (data) {
	  	//update lock database
	  	if(data.version != SMARTAPP_VERSION)
  		{
	  		//SmartApp needs update
	  		alert("Your SmartApp needs to be updated. Please go to goo.gl/ZAKGII to get the latest SmartApp code");
	  		
	  		//leave
	  		tizen.application.getCurrentApplication().exit();
  		}
	  },
	  error: function(e){
	  	//handle that error
	  	errorHandling(e, "Your SmartApp needs to be updated. Please go to goo.gl/ZAKGII to get the latest SmartApp code");
	  	
	  	//leave
	  	tizen.application.getCurrentApplication().exit();
	  }
	});
}

//------------------------------------------------------------------------------------End Check SmartApp Version


//------------------------------------------------------------------------------------Start Logout
function Logout()
{
	//get confirmation
	var ruSure = confirm("Are you sure you want to Logout? This will clear all data on the app and you will need to reverify with Smartthings.");
	
	//if they're sure.
	if(ruSure)
	{
		//clear the entire DB and global vars
		localStorage.clear();
		Access_Token = null;
		Access_Url = null;
		switches_DB = null;
		
		//let the setup page run again
		setupPageRan = false;
		
		//let the user know we just destroyed everything
		alert("You have been logged out. All data is cleared.");
		
		//redirect to setup page
		tau.changePage("setupPage");
	}
}
//------------------------------------------------------------------------------------End Logout

//------------------------------------------------------------------------------------Start Clear Database
function CleanDatabase()
{
	//clear the device / routine / room data	
	routines_DB = null
	switches_DB = null;
	locks_DB = null;
	
	localStorage.setItem("switches_DB", null);
	localStorage.setItem("routines_DB", null);
	localStorage.setItem("locks_DB", null);
	
	//let the user know we just destroyed everything
	alert("Database Cleaned.");
}
//------------------------------------------------------------------------------------End Clear Database

//------------------------------------------------------------------------------------Start Encryption Functions
//temporary, quick but can be much stronger.
function Encrypt(str) 
{
	//check if string is null
    if (!str)
    	str = "";
    
    //do some more checks on it
    str = (str === "undefined" || str === "null") ? "" : str;
    
    try 
    {
    	//get the encryptkey we set
        var key = EncryptKey;
        
        //initialize the vars
        var pos = 0,
        	ostr = '';
        
        //encryption algorithm
        while (pos < str.length) 
        {
            ostr = ostr + String.fromCharCode(str.charCodeAt(pos) ^ key);
            pos += 1;
        }
        
        return ostr;
    } 
    catch (ex) 
    {
        return '';
    }
}
function Decrypt(str) 
{
	//check if string is null
    if (!str)
    	str = "";
    
    //do some more checks in string
    str = (str === "undefined" || str === "null") ? "" : str;
    
    try 
    {
    	//get encrypt key we set
        var key = EncryptKey;
        
        //initialize vars
        var pos = 0,
        	ostr = '';
        
        //decryption algorithm
        while (pos < str.length) 
        {
            ostr = ostr + String.fromCharCode(key ^ str.charCodeAt(pos));
            pos += 1;
        }
        
        return ostr;
    } 
    catch (ex) 
    {
        return '';
    }
}
//------------------------------------------------------------------------------------End Encryption Functions

//------------------------------------------------------------------------------------Notes


//------------------------------------------------------------------------------------Notes
