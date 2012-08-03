steal('jquery', 'can/control', 'can/control/plugin', 'can/view', 'can/observe',
function($) {
	can.Control('can.ui.List', {
		pluginName : 'list',
		defaults : {
			attribute : 'data-cid',
			cid : '_cid'
		}
	}, {
		init : function() {
			this._cidMap = {};
			this.update();
		},

		/**
		 * Updates the options and forces re-rendering the list.
		 *
		 * @param {Object} [options] The options to udpate
		 */
		update : function(options) {
			can.Control.prototype.update.call(this, options);
			var list = this.options.list;
			if(list && list.isComputed) {
				list = list();
			}
			this._update(list);
		},

		/**
		 * Updates the data list and sets this.options.data. Converts Arrays
		 * and waits for Deferreds.
		 *
		 * @param {can.Deferred|can.Observe.List|Array} data The data to set
		 * @private
		 */
		_update : function(data) {
			data = data || [];
			if(can.isDeferred(data)) {
				this.element.html(this._fnView('loadingContent'));
				data.done(can.proxy(this._update, this));
			} else {
				this._cidMap = {};
				this.options.data = data instanceof can.Observe.List ? data : new can.Observe.List(data);
				this.on();
				this._render(this._rows(this.options.data));
			}
		},

		/**
		 * Returns a can.$ wrapped list of rendered rows for the given observes.
		 *
		 * @param {Array|can.Observe.List} observes The observables to render
		 * @return {can.$} A can.$ wrapped list of rendered rows
		 * @private
		 */
		_rows : function(observes) {
			var self = this;
			observes = can.makeArray(observes);
			var rows = $.map(observes, can.proxy(function(observe) {
				// Update the mapping from can.Observe unique id to Observe instance
				self._cidMap[observe[self.options.cid]] = observe;
				return self._fnView('view', observe);
			}, this));
			return can.$(rows);
		},

		/**
		 * Renders the row element list. If the rows are empty or there
		 * are no rows, the content set in the `empty` option will be rendered.
		 *
		 * @param rows
		 * @private
		 */
		_render : function(rows) {
			var content = !rows || rows.length === 0 ? this._fnView('emptyContent') : rows;
			this.element.html(content);
			this.element.trigger('rendered', this);
		},

		_fnView : function(name, args) {
			var val = this.options[name];
			return can.isFunction(val) ? val.call(this, args) : can.view(val, args);
		},

		'{list} change' : function(target, ev, newVal) {
			if(target.isComputed) {
				this._update(newVal);
			}
		},

		'{data} length' : function(list, ev, length) {
			if(length === 0) {
				this._render();
			}
		},

		'{data} remove' : function(list, ev, observes) {
			if(list.length) { // We can't get rowElements from an empty list
				var self = this;
				// Remove the CID mapping
				can.each(observes, function(observe) {
					delete self._cidMap[observe[self.options.cid]];
				});
				this.rowElements(observes).remove();
				this.element.trigger('changed', this);
			}
		},

		'{data} add' : function(list, ev, observes) {
			var rowElements = this.rowElements(),
				newRows = this._rows(observes);
			if(rowElements.length) {
				// We either append after the last data row
				rowElements.last().after(newRows);
			} else {
				// Or set it as the content
				this.element.html(newRows);
			}
			this.element.trigger('changed', this);
		},

		/**
		 * Returns a `can.Observe.List` of all observes or all observes for the given row elements.
		 * This can be used to retrieve the observable for a row that was clicked:
		 *
		 *      var data = $('#list').list('list');
		 *      data // -> can.Observe.List
		 *
		 *      $('li[data-cid]').on('click', function() {
		 *          var observe = $('#list').list('list', this)[0];
		 *      });
		 *
		 * @param {jQuery|Array} arg The list of rows to retrieve the observables for
		 * @return {can.$} The jQuery wrapped collection of matching rows
		 */
		rowElements : function(arg) {
			if(!arg) {
				return this.element.find('[' + this.options.attribute + ']');
			}

			var elements = [],
				observes = can.isArray(arg) ? arg : can.makeArray(arguments);

			can.each(observes, can.proxy(function(current) {
				var row = this.element.find('[' + this.options.attribute + '="' + current[this.options.cid] + '"]')[0];
				elements.push(row || null);
			}, this));

			return can.$(elements);
		},

		/**
		 * Returns a `can.Observe.List` of all observes or all observes for the given row elements.
		 * This can be used to retrieve the observable for a row that was clicked:
		 *
		 *      $('li[data-cid]').on('click', function() {
		 *          var observe = $('#list').list('items', this)[0];
		 *      });
		 *
		 * Or to remove a `can.Model` from the list when clicking on a `.remove` element in a row:
		 *
		 *      $('#list').on('click', '.remove', function() {
		 *          var row = $(this).closest('li[data-cid]'),
		 *          model = $('#list').list('items', row)[0];
		 *
		 *          // A destroyed model will be automatically removed
		 *          // from any list
		 *          model.destroy();
		 *      });
		 *
		 * @param {jQuery} rows The collection of row elements
		 * @return {can.Observe.List}
		 */
		items : function(rows)
		{
			if(!rows) {
				return this.list();
			}

			var result = new can.Observe.List(),
				map = this._cidMap;

			can.each(can.makeArray(rows), function(row) {
				row = row[0] || row;
				// Either use getAttribute or the name itself as the index
				// that way you can pass a list of ids as well
				var id = row.getAttribute('data-cid');
				if(map[id]) {
					result.push(map[id]);
				}
			});

			return result;
		},

		/**
		 * `Returns a `can.Observe.List` with the currently displayed data.
		 * When passing `newList`, the List will be updated with that list. `$(element).list('list')` is the best way
		 * to work with the resolved list data, for example when a Deferred was passed initially:
		 *
		 *      $('#list').list({
		 *          loadingContent : '<li>Please wait...</li>',
		 *          emptyContent : '<li class="empty">Sorry, nothing found...</li>',
		 *          view : 'rowEJS',
		 *          list : Person.findAll()
		 *      });
		 *
		 *      // When the list is rendered, remove the last element
		 *      $('#list').on('rendered', function(ev) {
		 *          $('#list').list('list').pop();
		 *      });
		 *
		 * @param {can.Observe.List|Array|can.compute|can.Deferred} newlist The list to replace
		 * @return {can.Observe.List|can.Observe} The currently displayed list
		 */
		list : function(newlist) {
			if(!newlist) {
				return this.options.data || new can.Observe.List();
			}
			this.update({
				list : newlist
			});
		}
	});
});
