/**
 * @author Pip Jones
 * @since  10/06/2016
 * 
 * Requires pluginMaker (my version adapted from Jupiter)
 * 
 * @todo Assumes bootstrap2! (for popover) needs rendering callback?
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
			dataProviders: []
		},

		// Plugin instance initialisation and configuration
		init: function (el, options) {
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
				stack: false, 					// the timeline seems to make more sense with no stacking, else it gets jumbled.
				zoomMin: 1000,					// we only have 1s resolution
				zoomMax: 100000000000, 			// feels reasonable: 3yrs.
			};
		},

		// @private call this before processing after adding all families. Can be re-called.
		// @see getVisGroup() to recalculate these Group Index on the fly.
		indexFamilyToGroup: function () {
			// Indexing
			// todo: this is a bit wasteful, just discards and rebuilds: make it more like "add to index"?
			this.dsGroups.clear();
			// Add groups together indexed via family+log group id (to differentiate e.g. 'S').
			var self = this;
			$.each(this.aFamilies, function (i, f) {
				$.each(self.aLogGroups[f], function (j, g) {
					var id = f + '.' + g;
					self.dsGroups.add({id: id, content: self.aGroupTitles[f][g], order: i++});
					self.aLogGroupIndex[id] = self.dsGroups.length;
				});
			});
		},

		// @private call this before processing after adding all families. Can be re-called.
		// @see getVisGroup() to recalculate these Group Index on the fly.
		indexGroup: function (meta) {
			// Add groups together indexed via family+log group id (to differentiate e.g. 'S').
			$.each(meta.logGroups, $.proxy(function (j, g) {
				var id = meta.family + '.' + g;
				// todo add UI group ordering to metadata? currently it's load sequence order
				this.dsGroups.add({id: id, content: meta.groupTitles[g], order: this.aLogGroupIndex.length});
				this.aLogGroupIndex[id] = this.dsGroups.length;
			}, this));
		},

		// trace helper/wrapper
		log: function (message) {
			if (typeof(console) !== 'undefined') {//IE
				console.log(message);
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

			// todo: use timeline strategy pattern, to enable switch to CHAPS-LINK for clustering, or other library?
			this.timeline = new vis.Timeline(this.element.get(0), this.dsItems, this.dsGroups, this.timelineOptions);

			// The mashup list...
			$.each(this.settings.dataProviders, $.proxy(function (i, dp) {
				this.loadInjectedData(dp);
			}, this));
		},

		/**
		 * @todo define injection pattern (ie. wrap this class in another with the TM injections?)
		 *
		 * @param meta Object {family: 'X', logGroupField:'', stateField:'', dateField:'', logGroups: ['',...], groupTitles:{'':'', ...},
		 * 	rangedLogs:{'':'', ...},  cssClassMap:{'':'', ...} }
		 */
		injectMetaData: function (meta) {
			// todo 'family' could be locally generated on-injection, it's just an index.
			this.aFamilies.push(meta.family);
			this.aLogGroups[meta.family] = meta.logGroups;
			this.aGroupTitles[meta.family] = meta.groupTitles;
			this.aCssClassMap[meta.family] = meta.cssClassMap;

			// meta reindex this.aLogGroupIndex
			this.indexFamilyToGroup();
		},

		/**
		 * Handles sync/async loading via dataProvider which performs either local or remote data-loading. 
		 * @param fnDataProvider should return to the callback a data Object {meta:{logGroupField:, stateField:, dateField:, groupTitles:{}, rangedLogs:{}, cssClassMap:{}}, data:{[ row, ... ]}}
		 */
		loadInjectedData: function (fnDataProvider) {

			// todo: I used to have the 'noun' here, but can't now. Wondering if dataProvider should be a class? to provide meta early.
			var jLoadingSpinner = $('<div class="' + this.settings.CSS.loading + '">Loading from data source...</div>')
				.prependTo($('.' + this.settings.CSS.loader));

			var data = fnDataProvider(
				this.settings.since,
				this.settings.until,
				this.settings.unitId,
				$.proxy(function (status, data) {
					if (status == 'success') {
						this.injectMetaData(data.meta);
						this.processLogs(data.data, meta);
					}
					else {
						alert('Sorry, the ' + noun + ' data failed to load. (' + status + ')');
					}

					jLoadingSpinner.remove();

				}, this));
		},

		/**
		 * Parses the API response data, scanning for instant-events and ranged-events, adding them to the timeline.
		 * Handles mixed types and tracks the states of the FSM-ranged-events (single data field, two rows for start-end)
		 * @param data Array rows of logs
		 * @param meta Object meta-data structure describing the data (see above)
		 */
		processLogs: function (data, meta) {
			var i, datum, eventStates = [], format, visGroup;
			var aTitles = meta.groupTitles;


			// Parse response, convert to vis.DataSet
			for (i = 0; i < data.length; i++) {
				datum = data[i];
				visGroup = this.getVisGroup(meta.family, datum[meta.logGroupField]);

				// todo move to a processor helper/strategy?
				// Check for state-ranged time-span events, (Ignition states, Sessions)
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

					// todo initially I'm just doing the happy path! convert to an FSM?
					if (datum[meta.stateField] == 1) {
						// Cache the start
						eventStates[datum[meta.logGroupField]] = datum;
					}
					else {
						// Assume 0 = off
						if (eventStates[datum[meta.logGroupField]]) {
							format = this.formatVisContent(meta, datum, aTitles[datum[meta.logGroupField]]);
							// End it and add ranged event to timeline
							this.dsItems.add({
								id: datum.logId,        													// which Log.ID to use: start or end?
								group: visGroup,
								start: eventStates[datum[meta.logGroupField]][meta.dateField],
								end: datum[meta.dateField],
								content: format.content,
								className: format.className
								 //type: 'background' // looks OK too
								// type: 'box' (default), 'point', 'range', or 'background'
								// style:
							});
							eventStates[datum[meta.logGroupField]] = null; //unset? pop? splice?
						}
						//else error / "start-open"
					}
				}
				else {
					// Single-log event records
					format = this.formatVisContent(meta, datum, datum[meta.titleField]);

					if(meta.endDateField){
						// Date-ranged single-log with start-end date
						this.dsItems.add({
							id: datum.logId,
							group: visGroup,
							start: datum[meta.dateField],
							end: datum[meta.endDateField],
							content: format.content,
							className: format.className
						});
					}
					else {
						// Instant event, single date, (GPS, Periodic, Alarms)
						this.dsItems.add({
							id: datum.logId,
							group: visGroup,
							start: datum[meta.dateField],
							content: format.content,
							className: format.className
						});
					}
				}
			}
			// Re-render the timeline, so the popovers will bind.
			this.timeline.fit(false);
			// Bind the log/event tooltip/popovers. container:body solves overflow clipping.
			// @todo assumes Bootstrap2! inject...
			$('.timeline-popover').popover({html: true, trigger: "hover", placement: "bottom", container: "body"});
		},

		/**
		 * @todo inject a template? or this should be a callback to the page... this JQ plugin shouldn't know about bootstrap.
		 * @private
		 * @param meta Object
		 * @param datum Object log row
		 * @param title String TODO HTML? SAFE?
		 * @return Object {content: '<content>', className: '<cssClass>'};
		 */
		formatVisContent: function (meta, datum, title) {
			format = this.formatSpecificLogs(meta, datum);
			// Uses Bootstrap popover.
			var content = ''
				+ '<a class="timeline-popover" '
				+ ' 	data-content="' + format.content + '" >'
				+ title
				+ '<span class="icon icon-info-sign">&nbsp;&nbsp;</span></a>';
			return {content: content, className: format.className};
		},

		/**
		 * This is a log type-specific formatter.
		 *
		 * @todo the idea here was to wrap all log types, but I'm now moving towards injecting these dependencies! this may evaporate
		 *
		 * @param meta Object
		 * @param datum Object
		 */
		formatSpecificLogs: function (meta, datum) {
			var logGroup = meta.logGroupField ? datum[meta.logGroupField] : ''; // '' is default for no grouping
			var content = '<pre>' + JSON.stringify(datum, null, " ").replace(/"/g, '&quot;') + '</pre>';  //pauper's formatter
			return {
				content: content,
				className: meta.cssClassMap[logGroup]
			};
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
