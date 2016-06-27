/**
 * pluginMaker helps reduce boilerplate code in JQuery plugins.
 * Just create a class with a name property set to the plugin name
 * with some methods, including an init(el,options)
 * and call pluginMaker on the class.
 * 
 * These things are helpfully added:
 * 	o .element property added to the instance: the $jq object of the element the plugin was applied to (not during init)
 * 	o $.data added to the JQ element containing the plugin instance, under the plugin name
 * 	o CSS class of the plugin name name added to the DOM element 
 * 
 * e.g.
 * 	Jptr = {};	// namespace for tidyness (or use a closure)
 * 	Jptr.Tabs = function(el, options) {
 *  	if(el) this.init(el, options);	
 * 	}
 * 	$.extend(Jptr.Tabs.prototype, {
 *		name: "jptr_tabs", 			// plugin name
 *		init: function(el, options) {/ * init code here * /},
 *		stuff: function(args...){ / * stuff method * / }
 *	});
 *	// turn the class into a JQuery plugin
 * 	$.pluginMaker(Jptr.Tab);
 * 
 * // Later
 * $('#tabs').jptr_tabs();				// Create plugin on element(s)
 * $('#tabs').jptr_tabs('stuff',arg);	// Call method on plugin(s)
 * 
 * @author http://jupiterjs.com/
 * @author pip jones - added $.data and debug helpers to creation; documentation
 * @param plugin Object 
 */
$.pluginMaker = function(plugin) {
    
  // add the plugin function as a jQuery plugin
  $.fn[plugin.prototype.name] = function(options) {
    
    // get the arguments 
    var args = $.makeArray(arguments),
        after = args.slice(1);

    return this.each(function() {
      
      // see if we have an instance
      var instance = $.data(this, plugin.prototype.name);
      if (instance) {
        
        // call a method on the instance
        if (typeof options == "string") {
          instance[options].apply(instance, after);
        } 
        else if (instance.update) {
          // call update on the instance
          instance.update.apply(instance, args);
        }
      } 
      else {
        // create the plugin
        p = new plugin(this, options);
        // 'register' the plugin for our lookup above & debug helpers
        $.data(this, p.name, p);
				p.element = $(this);
				p.element.addClass(p.name);
      }
    });
  };
};
