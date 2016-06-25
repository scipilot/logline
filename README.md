# logline
Log Event Timeline Visualisation - jQuery plugin.

Logline is a Vis.js Timeline wrapper to mash up and display log data from various formats and customised providers.

- Uses the vis.js Timeline library, which is incredibly powerful and intuitive.
- Mashes up from multiple REST APIs or local data, from injected data-providers.
- Handles different types of time-ranged events and log formats.
- Groups logs into vis Timeline groups, with a "Misc" group to catch poorly formatted logs (it happens).
- Installs popovers for more detail (currently BS2!)
- Auto-fits the range on data load.
- Can present loading spinners while API data is loading.

The only dependency vis.js must be loaded first. Oh and JQuery of course.

Logs time formats supported:

     1. "statefully-ranged" : flip-flop/FSM over two logs with one time field and a boolean state field for on/off 
     2. "pre-ranged" : one log with two time fields, start-end
     3. "instant" events: not ranged, one log one time field

These formats came from real-world scenarios with various devices producing various log formats. 

The state-ranged logs are where you have two logs per event, one at the start with a state=1 and a date, 
then another log at the end of event's time period with a state=0. This plugin tracks the state of these events 
and formats the timeline time-span accordinly. It can deal with intermingled and overlapping events, (as long as they are different).    
It can also deal with "endless" and "beginningless" events if the time-window chops off one of the pair, or the original data is lossy.
e.g. If there is no-end and then a new start (in one sub-type) it will auto-close and restart the event, assuming an end 
(otherwise you'd get an overlapping block to infinity!).

The other two formats are more obvious and simpler to process. Something happened: either at X time or between Y and Z - in one log. 

## Configuration Options

init options (with defaults):

    API.URL: string                   Base URL of the REST API
    unitId: integer                   ID of the logged device
    since: Datetime                   Initial time window filter
    until: Datetime
    CSS.loading: ('loading')          Class which is applied/removed to the spinner during api loading.
    CSS.loader: ('loader')            Class of an element into which the spinner will be appended.
    dataProviders: Array [func, ...]  Callback functions which will return injected data (below)
	onDataLoaded: function()          Callback for when all data series have loaded
    format: function(meta, datum)     Callback to format each log for the timeline (below)

You can define a 'loading' CSS class e.g. with a spinner, this is added/removed automatically:

    .timeline.loading {
        background:url(/images/loading.gif) center center no-repeat;
        background-size: 30px;
    }

### Data Injection

You must inject dataProvider functions which are called in turn to fetch the data, and metadata describing how to map the logs into the timeline.

The dataProvider functions should have this signature:

    provider(unitId, since, until, callback);

The dataProvider functions should asynchronously return this to the callback:
    
    callback( ["success"|"error"], {data: [data,...], meta: { <metadata> } )

The data rows can contain any fields (columns), but only those described in the metadata will be interpreted.
All other fields will be displayed in the pre-formatted "details" popovers for user reference.

The metadata describing the data has the following properties:

     {
		family: 'X', 					// Unique log family ID
		apiNoun:'tripLog',				// For API-loaded data, the REST noun to query
		stateField:'<fieldname>',		// Optional; Which log field flip-flops the start-end state (for state-ranged logs)
		dateField:'<fieldname>',		// Which log field contains the FSM date; or the start date if endDateField is included
		endDateField:'<fieldname>',		// Optional; indicates this is a pre-ranged timespan event.
		logGroupField:'<fieldname>',	// Optional; Which log field is the logGroup [e.g. type|event] for logs with sub-types.
		logGroups: ['', 'X', 'Y' ...], 	// A list of logGroup (sub-types) found in the logGroupField. Just [''] for logs with no sub-types.
		groupTitles:{'X':'Foo', ...},	// A map of human titles, indexed by logGroups. Note: instant-events use the event data itself as the title and don't use this!
		rangedLogs:['Y', ...],  		// Optional; Which of the logGroup sub-types are state-ranged flip-flops. Those not present in this list are treated as instant events.
		cssClassMap:{'X': 'class', ...},// Optional; map of CSS classes for each logGroup sub-type, applied to the Vis element itself.
        onTimelineUpdated:function(){}, // Optional; callback for when this data has been processed into the timeline
        stack: true|false               // Optional, default false; whether to stack the events inside this group, instead of them overlapping.  
	}

### Content Formatting

Formatting each type of log entry into the timeline is performed by callbacks, with a simple default.
To override the default, provide a function of this signature which will receive each data row, 
and a copy of the metadata you provided, (to identify which series you are processing). 
You must return an HTML rendered block which will be inserted into the vis-content and assigned the class name.   

Optionally, you can override the Vis.js type and any hard-coded CSS styles (not recommended of course!).
Note: 'type' is set automatically by this plugin to either 'range' or 'box' according to the log type.

    function (meta, datum){
        return {
            content: <HTML>,
            className: <CSS class>,
            type: ['box' (default) } | 'point' | 'range' | 'background']
            style: <CSS>
        };
     }

## Usage

e.g.

    <script src="js/vis/vis.min.js"></script>
    <script src="js/jquery/jquery.pluginmaker.js"></script>
    <script src="js/jquery.scipilot-logline.js"></script>
    <link href="js/vis/vis.min.css" rel="stylesheet" type="text/css" />

    $('#timeline').scipilot_logline({
			API: {URL: 'https://tmapi.mysite.com/'},
			unitId: 2600,
			since:  '2016-05-05T12:00:00+10:00',
			CSS: {loader: 'timeline-loader', loading: 'loading span2 alert alert-info clearfix'}
		})
    .scipilot_logline('load');

