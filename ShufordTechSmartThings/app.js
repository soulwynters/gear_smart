//Page Views
var MainPageRan = false;
var SwitchPageRan = false;
var RoutinesPageRan = false;
var setupPageRan = false;

//Polling interval in ms for token
var pollingInt = 20000;

//Encrypt Key (This should be set by the user)
var EncryptKey = 2092342;

//Databases
var Access_Token = Decrypt(localStorage.getItem("token_DB"));
var Access_Url = Decrypt(localStorage.getItem("AccessUrl_DB"));
var switches_DB = localStorage.getItem("switches_DB");
var routines_DB = localStorage.getItem("routines_DB");

//TAU UI Helpers (to create/destroy)
var SwitchList_UI = null;
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
			RoutineList_UI.destroy();
			break;
		case "switchesPage":
			SwitchList_UI.destroy();
			break;
		default:
			//do nothing
	}
});
//------------------------------------------------------------------------------------End On Page Changes

//------------------------------------------------------------------------------------Start Setup Page
function SetupPage(){
	CheckInternet();
	
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
		    "Authorization": "Token 98b7d003-4701-40fb-8295-b2dded696f26"
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
		error: function(xhr, textStatus, errorThrown)
		{
			alert("server error ocurred, please contact venumx@live.com");
		}
	});
}
//------------------------------------------------------------------------------------End Setup Page

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
			tau.changePage("mainPage");
			//alert('Setup Complete! App will now close, please restart it!');
			//tizen.application.getCurrentApplication().exit();
		},
		error: function(xhr, textStatus, errorThrown)
		{
			//if we reported a 400 this means auth is not ready yet, try again in 20 seconds
			if(xhr.status === '400'){
			    setTimeout( function(){ getStatus(auth_id); }, pollingInt );
			}
		}
	});
}

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
		
		// ??????????
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
				// ??????????
				$(WhatRoutine).parent().find('.ui-processing').hide();
		    },
		    error: function(e){
		    	//handle the error
		    	errorHandling(e, "There was an error triggering your Routine from Smartthings.");
		    	
		    	//show the routine buton again
				$(WhatRoutine).show();
				
				// ??????????
				$(WhatRoutine).parent().find('.ui-processing').hide();
		    }
		});
	});
}
//------------------------------------------------------------------------------------End Routines Page

//------------------------------------------------------------------------------------Start Main Page
function MainPage(){
	//is the access token set?
	if(Access_Token){
		//has the user been here before?
		if(MainPageRan === false){
			//he has now.
			MainPageRan=true;
		}else{	
			//hes been here
		}
	}else{
		//access token is not set. 
		tau.changePage("setupPage");
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
				case "Clear Database":
					//clear the db - moved to it's own function
					ClearDatabase();
					break;
				default:
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
	
	//have we run the switch page yet?
	if(SwitchPageRan === true){
		$.when(SwitchPageGetData()).done(function() {
			SwitchPage_Buttons();
		});
	}else{
		//This is the first time the user has looked at this page!
		SwitchPageRan = true;
		$.when(SwitchPageGetData()).done(function() {
			SwitchPage_Buttons();						
		});
	}
}

function SwitchPageGetData(){
	
	//Clear Switches
	$('#Switches').html('');
	
	//We have switch data stored!
	if(switches_DB !== null){ 
		try {
			//get the switches as a json object
			var obj = jQuery.parseJSON(switches_DB);
			
			//build the list with the existing data we have
			$.each(obj, function(index, element) {
				var id = element.id;
				var label = element.label;
				var value = element.value;
				var type = element.type;					    
				var checked = "";
				if(value==="on"){ checked = "checked"; }			        	
				$('#Switches').append('\
					<li class="li-has-checkbox">\
						<div class="ui-marquee ui-marquee-gradient marquee">'+label+'</div>\
						<input class="aswitch" deviceid="'+id+'" type="checkbox" ' + checked + '/>\
						<div class="ui-processing" style="display:none;"></div>\
					</li>\
				');
			});
			$('#Switches').append('\
				<li class="">\
					<div id="RefreshSwitchData" class="ui-marquee ui-marquee-gradient marquee">Refresh Data</div>\
				</li>\
			');

			//fancy GUI stuff
			var switcherr = document.getElementById("Switches");
			SwitchList_UI = tau.helper.SnapListMarqueeStyle.create(switcherr, {
				marqueeDelay: 0,
				marqueeStyle: "endToEnd"
			});
			
		} catch (e) {
			//some error happened, invalid json stored?
			alert("There was an error! The database may be corrupted, try clearning it.");
			console.log(e);
			return;
		}
	}else{ 
		//We couldn't find the switches database data, so lets build it.
		
		//set the processing message and redirect to processing page
		$('#ProcessingMsg').html('Retrieving Switches From SmartThings');
		tau.changePage("processingPage");
		
		//get those switches
		$.get({
		    url: Access_Url + "/switches",
		    beforeSend: function(xhr) { 
		      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
		    },
		    success: function (data) {
		    	//get the response as a string and send to the database
		    	data = JSON.stringify(data);
				localStorage.setItem("switches_DB", data);
				
				//lets get the json version stored in our global switches var
				switches_DB = data;
				
				//we can go to the switches page now
		        tau.changePage("switchesPage");
		    },
		    error: function(e){
		    	//handle the errors
		    	errorHandling(e, "There was an error getting your Switches from Smartthings.");
				
		    	//go back to switches page
		    	tau.changePage("switchesPage");
		    }
		});
	}
}

function SwitchPage_Buttons(){
	
	//hanndle the click of the refresh switches button
	$('#RefreshSwitchData').click(function(){
		//clear the switch db and global var
		localStorage.setItem("switches_DB", null);
		switches_DB = null;
		$('#Switches').html('');
		
		//set the processing message and show processing page
		$('#ProcessingMsg').html('Retrieving Switches From SmartThings');
		tau.changePage("processingPage");
		
		//wait 2 seconds and change to switches page
		setTimeout(function(){ tau.changePage("switchesPage"); }, 2000); //:)
	});

	//user pressed a switch
	$(".aswitch").change(function(){
		
		//set the switch
		var WhatSwitch = this;
		
		//hide the switch, show processing
		$(WhatSwitch).hide();
		$(WhatSwitch).parent().find('.ui-processing').show();
		
		//get url safe deviceid var
		var DeviceID = encodeURIComponent($(this).attr('deviceid'));
		
		//was the switch turning on or off?
		if($(this).is(":checked")) {
			//turning on
			$.get({
			    url: Access_Url + "/switches/" + DeviceID + "/on",
			    beforeSend: function(xhr) { 
			      xhr.setRequestHeader('Authorization','Bearer ' + Access_Token);
			    },
			    success: function (data) {
			    	//getthe json data returned for the switch - and do nothing with it??
			    	data = JSON.stringify(data);
			    	
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
			    	//get the data in json format - do nothing with it??
			    	data = JSON.stringify(data);
			    	
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

//------------------------------------------------------------------------------------App's Back Button Handler
window.addEventListener( 'tizenhwkey', function( ev ){
	console.log("Back Key Hit");
	var page = document.getElementsByClassName('ui-page-active')[0],
	pageid = page ? page.id : "";
	if(ev.keyName === "back") {
		if( pageid === "mainPage" ) {
           tizen.application.getCurrentApplication().exit();
		}else if(pageid === "setupPage"){
			tizen.application.getCurrentApplication().exit();
		} else {
	         tau.changePage("mainPage");
		}
	}
});
//------------------------------------------------------------------------------------App's Back Button Handler

//-----------------------------------------HELPER FUNCTIONS-------------------------------------------//

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
function CheckInternet(){
	if(navigator.onLine === false){
		//Maybe this should be done each time before an api call is fired incase we lose connection after starting the app..
		//If so, move isOnline = navigator.onLine also
		alert('No internet connection, please connect first.');
		tizen.application.getCurrentApplication().exit();
	}
}
//------------------------------------------------------------------------------------End Check Internet Status

//------------------------------------------------------------------------------------Start Clear Database
function ClearDatabase()
{
	//lets log we are clearing
	console.log("Clearing Database");
	
	//clear the entire DB and global vars
	localStorage.clear();
	Access_Token = null;
	Access_Url = null;
	switches_DB = null;
	
	//let the user know we just destroyed everything
	alert("Database Cleared");
}
//------------------------------------------------------------------------------------End Clear Database

//------------------------------------------------------------------------------------Start Encryption Functions
//temporary, quick but can be much stronger.
function Encrypt(str) {
    if (!str) {str = "";}
    str = (str === "undefined" || str === "null") ? "" : str;
    try {
        var key = EncryptKey;
        var pos = 0;
        var ostr = '';
        while (pos < str.length) {
            ostr = ostr + String.fromCharCode(str.charCodeAt(pos) ^ key);
            pos += 1;
        }
        return ostr;
    } catch (ex) {
        return '';
    }
}
function Decrypt(str) {
    if (!str) {str = "";}
    str = (str === "undefined" || str === "null") ? "" : str;
    try {
        var key = EncryptKey;
        var pos = 0;
        var ostr = '';
        while (pos < str.length) {
            ostr = ostr + String.fromCharCode(key ^ str.charCodeAt(pos));
            pos += 1;
        }
        return ostr;
    } catch (ex) {
        return '';
    }
}
//------------------------------------------------------------------------------------End Encryption Functions

//------------------------------------------------------------------------------------Notes
/*
 * might use for dimmers
	window.addEventListener("rotarydetent", rotaryDetentCallback);
	function rotaryDetentCallback(ev) {
		var direction = ev.detail.direction,
		    uiScroller = $('#main').find('.ui-scroller'),
		    scrollPos = $(uiScroller).scrollTop();
		
		console.debug("onRotarydetent: " + direction);
		
		if(direction === "CW"){
		    $(uiScroller).scrollTop(scrollPos + 100); // scroll down 100px
		} else {
		    $(uiScroller).scrollTop(scrollPos - 100); // scroll up 100px
		}
	}
*/
//------------------------------------------------------------------------------------Notes
