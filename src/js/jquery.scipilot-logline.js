/**
 * @author Pip Jones
 * @since  10/06/2016
 *
 * Requires pluginMaker (my version adapted from Jupiter)
 *
 * @todo add UI group ordering to metadata? currently it's load sequence order
 * @todo Option: remove empty groups, or collapse them: changes are confusing.
 * @todo trouble with the full-height
 * @todo 'family' could be internally generated on data injection, it's just an index and the user doesn't care about it.
 * @todo Repaired or modified logs should be visually flagged.
 * @todo Split into core logic and JQuery plugin wrapper, so it can be used independently of JQuery
 * @todo [workaround:window limited]Display the time-window on the background, to indicate where data is truncated (until infinite load is implemented!)
 */
(function ($) {
	// Define plugin class.
	var ScipilotLoglineVisTimeline = function (el, options) {
		this.settings = {};
		if (el) this.init(el, options);
	};

	$.extend(ScipilotLoglineVisTimeline.prototype, {
		// plugin name
		name: 'scipilot_logline',

		// the vis timeline object
		timeline: null,
		dsItems: null,
		dsGroups: null,

		aFamilies: [],

		// Define how the events are grouped. Group 0= default/misc if no match on event name.
		aLogGroups: {},
		aLogGroupIndex: [], // index built dynamically

		// Content hashes (group titles) indexed by the log group.
		aGroupTitles: {},
		// CSS Classes for each log/event type
		aCssClassMap: {},

		// stores vis.js Timeline options
		timelineOptions: {},

		// Default settings -----------------------------------------
		defaults: {
			API: {
				URL: ''
			},
			unitId: null,
			since: '',
			until: '',
			'CSS': {
				'loading': 'loading',
				'loader': 'loader'
			},
			dataProviders: [],
			format: function(meta, datum){
				// default/example formatter, just put the title or dump the whole log into the timeline
				var logGroup = meta.logGroupField ? datum[meta.logGroupField] : ''; // '' is default for no grouping
				var content = datum[meta.titleField];
				//var content = '<pre>' + JSON.stringify(datum, null, " ").replace(/"/g, '&quot;') + '</pre>';  //pauper's formatter

				return {
					content: content,
					className: meta.cssClassMap[logGroup]
				};
			}
		},
		seriesLoaded: 0, // tracks DP loading progress

		// default/example event handler
		onDataLoadedDefault: function(){
			this.log("All data loaded!");
		},

		// Plugin instance initialisation and configuration
		init: function (el, options) {
			// default (Have to scope this in advance, and need to wait until init before this is set)
			this.defaults.onDataLoaded = $.proxy(this.onDataLoadedDefault, this);

			// If options exist, merge them with a copy of the defaults into our instance settings
			if (options) {
				this.settings = $.extend({}, this.defaults);
				$.extend(this.settings, options);
			}

			// Timeline configuration
			this.timelineOptions = {
				// todo: trouble with the height is if the number of groups gets higher, it crops it with no inner scrollbar...
				//height: window.innerHeight - 200, // todo: calculate, remove header etc. make "full screen" (tried 100%)
				maxHeight: window.innerHeight, 	// I fixed this which make the UX feel more consistent.
				stack: false, 						// the timeline seems to make more sense with no stacking, else it gets jumbled.
				zoomMin: 1000,						// we only have 1s resolution
				zoomMax: 100000000000, 		// feels reasonable: 3yrs.
				min: this.settings.since,	// with pre-set date range I think it feels better to limit the view to the data period
				max: this.settings.until	// else the user may think there's just no data. I'd prefer to grey-out the non-loaded area...
			};
		},

		// @private call this before processing after adding all families. Can be re-called.
		// @see getVisGroup() to recalculate these Group Index on the fly.
		indexGroup: function (meta) {
			// Add groups together indexed via family+log group id (to differentiate e.g. 'S').
			if(meta.logGroups){
				$.each(meta.logGroups, $.proxy(function (j, g) {
					var id = meta.family + '.' + g;
					this.dsGroups.add({id: id, content: meta.groupTitles[g], order: meta.order + j});
					this.aLogGroupIndex[id] = this.dsGroups.length;
				}, this));
			}
		},

		// trace helper/wrapper
		log: function (message) {
			if (typeof(console) !== 'undefined') {//IE
				console.log.apply(console, arguments);
			}
			else {
				this.log += message + "\n";//IE
			}
		},

		/** Updates the API.URL setting */
		setAPIURL: function (sURL) {
			this.settings.API.URL = sURL;
		},

		/** Loads the data from the configured API and displays it in a vis.js Timeline */
		load: function () {
			// Create a DataSet (with two-way data binding)
			this.dsItems = new vis.DataSet();
			this.dsGroups = new vis.DataSet();

			this.timeline = new vis.Timeline(this.element.get(0), this.dsItems, this.dsGroups, this.timelineOptions);

			// Load the data mashup list
			this.seriesLoaded = 0;
			$.each(this.settings.dataProviders, $.proxy(function (i, dp) {
				this.loadInjectedData(dp, this.settings.dataProviders.length, i+1);
			}, this));
		},

		/**
		 * @param meta Object {family: 'X', logGroupField:'', stateField:'', dateField:'', logGroups: ['',...], groupTitles:{'':'', ...},
		 * 	rangedLogs:{'':'', ...},  cssClassMap:{'':'', ...} }
		 */
		injectMetaData: function (meta) {

			meta.logGroups = meta.logGroups ? meta.logGroups : ['']; // default to one subgroup, and "correct" the metadata (by reference)

			// meta reindex this.aLogGroupIndex
			this.indexGroup(meta);
		},

		/**
		 * Handles sync/async loading via dataProvider which performs either local or remote data-loading.
		 * @param fnDataProvider should return to the callback a data Object {meta:{logGroupField:, stateField:, dateField:, groupTitles:{}, rangedLogs:{}, cssClassMap:{}}, data:{[ row, ... ]}}
		 * @param total int Number of series to be loaded
		 * @param index int 1-based index of which series this is
		 */
		loadInjectedData: function (fnDataProvider, total, index) {

			// todo: I used to have the 'noun' here, but can't now. Wondering if dataProvider should be a class? to provide meta early.
			var jLoadingSpinner = $('<div class="' + this.settings.CSS.loading + '">Loading data from source '+index+'/'+total+'...</div>')
				.prependTo($('.' + this.settings.CSS.loader));

			var data = fnDataProvider(
				this.settings.unitId,
				this.settings.since,
				this.settings.until,
				$.proxy(function (status, data) {
					if (status == 'success') {
						this.injectMetaData(data.meta);
						this.processLogs(data.data, data.meta);
					}
					else {
						alert('Sorry, the ' + data.meta.apiNoun + ' data failed to load. (' + status + ')');
					}

					jLoadingSpinner.remove();

					// Detect the overall end, allowing any async load order
					if(++this.seriesLoaded == total) this.settings.onDataLoaded();

				}, this));
		},

		/**
		 * Parses the API response data, scanning for instant-events and ranged-events, adding them to the timeline.
		 * Handles mixed types and tracks the states of the FSM-ranged-events (single data field, two rows for start-end)
		 * @param data Array rows of logs
		 * @param meta Object meta-data structure describing the data (see above)
		 */
		processLogs: function (data, meta) {
			// Note: eventStates must be an Object for $.each to work, as its a hash.
			var i, datum, eventStates = {}, visGroup, iSubGroup=1;
			var end = null, start = null;

			// Parse response, convert to vis.DataSet
			for (i = 0; i < data.length; i++) {
				datum = data[i];
				visGroup = this.getVisGroup(meta.family, datum[meta.logGroupField]);
				end = null;
				start = null;

				// If this log group is defined as a ranged-log,
				// Check for "state-ranged" time-span events, with a log per state transition (e.g. Key states, Sessions)
				if (meta.rangedLogs && meta.rangedLogs.indexOf(datum[meta.logGroupField]) != -1) {

					// 1 starts it, 0 ends it. Note it may "start open" or "never close", in the time window.
					// Truth table: - = no state recorded, 0/1 = state previously recorded
					// State	Receive 	Scenario 					Action
					// -----+----------+-----------------+-------
					//	-			0					End "start-open"	End new event starting from beginning of window, add to timeline.
					//									Log error					End new event starting after last similar state event, add to timeline.
					//	- 		1					Begin state				Begin new event starting now
					// 	0			0					Error							Delete impossible 0 state
					// 	0			1					Error							Delete impossible 0 state. Begin new event starting now.
					//	1			0					End state					End existing event, add to timeline.
					//	1			1					Log Error?				End existing event, add to timeline. Begin new event starting now.
					//	0			- 				Wont happen
					//	1			- 				"never closed"		End existing event, add to timeline.
					//
					// The error handling here is in interesting.
					// - Consecutive 1s or 0s are "wrong" but possible, due to cham_log errors, loss, or same-second events.
					// - State=0 won't happen as we don't store them here.
					// - Time-window "start open" scenarios can be indistinguishable from log-errors.
					// - We need to scan the state cache at the end of the dataset to detect "never close" and close them off.

					if (datum[meta.stateField] == 1) {
						// Check for error / collision in cache
						if(eventStates[datum[meta.logGroupField]]){
							// State 1:1
							// Close prior event with end from this one, then continue with new one.
							// TODO : perhaps this log should be visually flagged as repaired or modified
							start = eventStates[datum[meta.logGroupField]][meta.dateField];
							end = datum[meta.dateField];
							this.addVisItem(meta, datum, start, end, null);
							this.log('Timeline warning: A stateful log with no end was detected and closed off. Perhaps a missing end-log? ', datum);
						}
						// State [0-]:1
						// Cache the start
						eventStates[datum[meta.logGroupField]] = datum;
					}
					else {
						// Assume 0 = off/end
						end = datum[meta.dateField];

						// Check we have a cached open event to close
						if (eventStates[datum[meta.logGroupField]]) {
							// State 1:0
							// End it and add ranged event to timeline
							start = eventStates[datum[meta.logGroupField]][meta.dateField];
							eventStates[datum[meta.logGroupField]] = null; //unset? pop? splice?
						}
						else {
							// State -:0
							// This is a log error or a "start-open" due to window cropping data
							// Default the start to the search window
							// TODO : perhaps this log should be visually flagged as repaired or modified
							start = this.settings.since;
						}
						this.addVisItem(meta, datum, start, end, null);
					}
				}
				else {
					// Single-log event records
					// Default to instant-event, single date, (e.g. GPS, Periodic, Alarms)

					// Check for for a pre-ranged events which will have the 'endDateField' set.
					// Also validate missing end-date, and fall back to pin rather than an endless range. (Or does Vis do that anyway?)
					if(meta.endDateField && datum[meta.endDateField]){
						// Date-ranged single-log with start-end date (e.g. Bookings, Incidents)
						end = datum[meta.endDateField];
					}
					// TODO : perhaps split the conditional, and the log with missing end should be visually flagged as repaired or modified

					// (Send unique subgroup in case it's stacking)
					this.addVisItem(meta, datum, null, end, iSubGroup++);
				}
			}

			// To finish up, we need to scan the working cache for unfinished eventStates ("never-closed")
			// and add them in with truncated endings.
			// TODO : perhaps this log should be visually flagged as repaired or modified
			end = this.settings.until;
			$.each(eventStates, $.proxy(function(i, datum){
				if(datum){
					this.addVisItem(meta, datum, null, end, null);
				}
			}, this));

			// Re-render the timeline, (else post-processing like popovers won't have anything to bind to).
			this.timeline.fit(false);

			// Fire event
			if(meta.onTimelineUpdated) meta.onTimelineUpdated();
		},

		/**
		 * Helper function to produce the Vis Item options and add it to the timeline
		 * @private
		 * @param meta Object
		 * @param datum Object
		 * @param start String Optional; Date string to override the date field.
		 * @param end String Optional; Send a date string to set an end date and make it a range.
		 * @param iSubGroup int Optional; If meta.stack is set, send unique IDs to separate items into stacked sub-groups.
		 */
		addVisItem: function(meta, datum, start, end, iSubGroup) {
			var type = 'box', visOpt;
			var visGroup = this.getVisGroup(meta.family, datum[meta.logGroupField]);
			var format = this.settings.format(meta, datum);

			// Default to Instant event, single date, (e.g. GPS, Periodic, Alarms)
			visOpt = {
				id: meta.family + datum.logId,
				group: visGroup,
				start: start ? start : datum[meta.dateField],
				content: format.content,
				className: format.className ? format.className : '',
				style: format.style ? format.style : null
			};

			// fake sub-grouping allows stacking per-group :)
			if(meta.stack)	visOpt.subgroup = iSubGroup;

			if(end){
				visOpt.end = end;
				type = 'range';
			}
			visOpt.type = format.type ? format.type : type;

			this.dsItems.add(visOpt);

		},

		/**
		 * @param family
		 * @param event
		 * @returns {string} Group Index for Vis.js timeline
		 */
		getVisGroup: function (family, event) {
			var id = family + '.' + event;

			// Check group exists, some logs are wrong (e.g. 'E.C' which has the RFID in the event, until it's reworked :-/)
			// if not found return the family "blank" group (misc)
			return this.aLogGroupIndex.hasOwnProperty(id) ? id : family + '.';
		}
	});

	// --------------------------------------------------------------
	// Create the JQ plugin from the Class
	$.pluginMaker(ScipilotLoglineVisTimeline);

})(jQuery);
