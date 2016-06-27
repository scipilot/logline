# logline

**Log Event Data Transformer for Timeline Visualisation - a jQuery plugin.**

Logline is a [Vis.js Timeline|http://visjs.org/] wrapper to help mash-up and process log data from various formats via customised providers.

I wrote it while building a complex timeline from many different sources of data. Vis.js is a visualisation tool, 
which presumes your data is in their format. If you are reviewing legacy timeseries data, you will need a data-transformation layer.
This tool hopes to present a solution to fit that gap and covers all the oddities of legacy device logs I've found so far.

- Uses the vis.js Timeline library, which is incredibly powerful, scalable and intuitive.
- Mashes up from multiple REST APIs or local data, via injected "data-providers".
- Handles different types of time-ranged events and log formats.
- Groups log sub-types into vis Timeline groups, with a "Misc" group to catch broken or unexpected logs (it happens).
- Can installs popovers for more detail, or any formatting via injected "content-formatter".
- Auto-fits the range on data load.
- Can present multiple loading spinners while API data is loading.

(One drawback of this plugin is you lose direct control of the Vis Timeline. I intend to add pass-through config, although you can just access the timeline property due to JS's lack of privates!). 

Dependencies

The only dependency vis.js must be loaded first. Oh, and JQuery of course.

Log time formats supported:

     1. "statefully-ranged" : flip-flop/FSM over two logs with one time field and a boolean state field for on/off  or begin/end
     2. "pre-ranged" : one log with two time fields, start-end
     3. "instant" events : not ranged, one log one time field

These formats came from real-world scenarios with various devices producing various log formats. (See demos)

The state-ranged logs are if you have two logs per event, one at the start with a state=1 and a date, 
then another log at the end of event's time period with a state=0. This plugin tracks the state of these events 
and formats the timeline time-span accordinly. It can deal with intermingled and overlapping events, (as long as they are different).    
It can also deal with "endless" and "beginningless" events if the time-window chops off one of the pair, or the original data is lossy.
e.g. If there is no-end and then a new start (in one sub-type) it will auto-close and restart the event, assuming an end 
(otherwise you'd get an overlapping block to infinity!).

The other two formats are more obvious and simpler to process. Either something happened at X, or between Y and Z - recorded in one log. 

## Configuration Options

init options (with defaults):

    API.URL: string                   Base URL of the REST API
    unitId: integer                   ID of the logged device
    since: Datetime                   Initial time window filter
    until: Datetime
    CSS.loading: ('loading')          Class which is applied to the spinner(s) created during data-loading.
    CSS.loader: ('loader')            Class of an element into which the spinner(s) will be appended.
    dataProviders: Array [func, ...]  Callback functions which will return injected data (below)
	onDataLoaded: function()          Event handler callback for when all data series have loaded
    format: function(meta, datum)     Event handler callback to format each log for the timeline (below)

> note: some of these parameters have become a little redundant since the data-loading and formatting were inverted back to the caller.

You can define a 'loading' CSS class e.g. with a spinner, this is added/removed automatically:

    .timeline.loading {
        background:url(/images/loading.gif) center center no-repeat;
        background-size: 30px;
    }

### Data Injection

You must inject dataProvider functions which are called in turn to fetch the data, and metadata describing how to map the logs into the timeline.

The dataProvider functions should have this signature:

    provider(unitId, since, until, callback);

The dataProvider functions should asynchronously return this to the callback, (which has the same signature as the JQuery XHR response):
    
    callback( ["success"|"error"], {data: [data,...], meta: { <metadata> } )

The data rows can contain any fields (columns), but only those described in the metadata will be interpreted.
All other fields can be displayed in the formatted content (e.g. "details" popovers for user drilldown/reference).

The metadata describing the data has the following properties:

     {
		family: 'X', 					// Unique log series family ID
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

### Grouping

Each data provider can return mixed logs of same structure but in different logical groups (e.g. different events, or categories).

The `logGroupField` must be a field in the data rows which identifies each log's type/sub-type/group/category (whatever you call it!). 
These types are internally collated into Vis Timeline Groups. They are un-stacked by default, but you can override that per data-provider.

The `logGroups` lists "known groups" and used to look up a few other maps (hashes).

- The `groupTitles` hash provides a lookup of the titles shown in the Timeline.
- The `cssClassMap` hash provides a lookup of the CSS classes to apply to each event: e.g. "info", "warning", "error" etc. or per-event specific colours.
- `rangedLogs` (see below) specifies which groups are state-ranged.

### Log time formats

These fields are required to specifiy the three possible log time formats mentioned above.  (Timestamps are Moment.js compatible.)

1. "statefully-ranged"

    stateField - the field containing 1/0 for start/end
    dateField - the field containing the timestamp of both start and end.
    rangedLogs - must include the stated-ranged group names (or '' if there are no groups)

2. "pre-ranged"

    dateField - the field containing the event-start timestamp.
    endDateField - the field containing the event-end timestamp.

3. "instant" events 

    dateField - the field containing the event timestamp.

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

Basic example 

    <script src="js/vis/vis.min.js"></script>
    <script src="dist/js/jquery.scipilot-logline.min.js"></script>
    <link href="js/vis/vis.min.css" rel="stylesheet" type="text/css" />

    $('#timeline').scipilot_logline({
			API: {URL: 'https://tmapi.mysite.com/'},
			unitId: 2600,
			since:  '2016-05-05T12:00:00+10:00',
			CSS: {loader: 'timeline-loader', loading: 'loading span2 alert alert-info clearfix'}
		})
    .scipilot_logline('load');

## Demos
 
 See demo/index.html for examples.
 
 (You will need to have installed vis using Bower)