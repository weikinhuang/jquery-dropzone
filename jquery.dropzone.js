/*!
 * HTML5 file drag and drop ajax upload jQuery wrapper - jQuery plugin 0.5.0
 *
 * Copyright (c) 2010 Wei Kin Huang (<a href="http://www.incrementbyone.com">Increment By One</a>)
 *
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 */
(function($, document, undefined) {
	var doc = $(document), has_support = !!(window.FileReader || window.FormData), has_large_file_support = !!window.FormData, empty = function(event, ui) {
		event.stopPropagation();
	}, buildForm = function(param, filename, filedata, boundary) {
		// Build RFC2388 string.
		return [ "--" + boundary, 'Content-Disposition: form-data; name="' + param + '"; filename="' + filename + '"', "Content-Type: application/octet-stream\r\n", filedata, "--" + boundary ].join("\r\n");
	};

	$.widget("ui.dropzone", {
		widgetEventPrefix : "dropzone",
		options : {
			url : location.href,
			autostart : true,
			refresh : 1000,
			name : "file",
			maxFiles : 25,
			maxFileSize : 1, // MBs
			largeMaxFileSize : 1, // MBs if large file support is avaliable
			global : true,
			data : null,
			fileData : null,
			dataType : "text",
			method : "POST",
			drop : empty,
			dragEnter : empty,
			dragOver : empty,
			dragLeave : empty,
			docDrop : empty,
			docEnter : empty,
			docOver : empty,
			docLeave : empty,
			queue : empty,
			error : empty,
			start : empty,
			success : empty,
			progress : empty,
			beforeSend : empty,
			complete : empty,
			disabled : false,
			prefix : "dz_file_"
		},
		current_xhr : null,
		events : null,
		has_started : false,
		file_queue : null,
		_create : function() {
			// initialize the file queue
			this.file_queue = [];

			// make sure we have the FileReader object before we do anything
			if (has_support) {
				var events = this._getEvents();
				// bind the drag/drop event handler to the element
				this.element[0].addEventListener("drop", events.element.drop, true);
				this.element.bind("dragenter." + this.widgetEventPrefix, events.element.dragenter).bind("dragover." + this.widgetEventPrefix, events.element.dragover).bind("dragleave." + this.widgetEventPrefix, events.element.dragleave);
				// bind the drag/drop event handler to the document
				document.addEventListener("drop", events.document.drop, false);
				doc.bind("dragenter." + this.widgetEventPrefix, events.document.dragenter).bind("dragover." + this.widgetEventPrefix, events.document.dragover).bind("dragleave." + this.widgetEventPrefix, events.document.dragleave);

				// add the jquery ui classes
				this.element.addClass("ui-dropzone ui-widget ui-widget-content ui-corner-all ui-state-default").attr({
					role : "dropzone"
				});
			}
		},
		_setOption : function(key, value) {
			$.Widget.prototype._setOption.apply(this, arguments);
			if (key == "prefix") {
				var prefix = this.options.prefix;
				// fix for all future files
				$.each(this.file_queue, function(i, f) {
					f.id = f.id.replace(prefix, value);
				});
				// fix for currently uploading file
				if (this.current_xhr && this.current_xhr.current_file) {
					this.current_xhr.current_file.id.replace(prefix, value);
				}
				this.options.prefix = value;
			}
		},
		destroy : function() {
			if (has_support) {
				var events = this._getEvents();
				// unbind the drag/drop event handler to the element
				this.element[0].removeEventListener("drop", events.element.drop, true);
				this.element.unbind("dragenter." + this.widgetEventPrefix, events.element.dragenter).unbind("dragover." + this.widgetEventPrefix, events.element.dragover).unbind("dragleave." + this.widgetEventPrefix, events.element.dragleave);
				// unbind the drag/drop event handler to the document
				document.removeEventListener("drop", events.document.drop, false);
				doc.unbind("dragenter." + this.widgetEventPrefix, events.document.dragenter).unbind("dragover." + this.widgetEventPrefix, events.document.dragover).unbind("dragleave." + this.widgetEventPrefix, events.document.dragleave);

				// remove the jquery ui classes
				this.element.removeClass("ui-dropzone ui-widget ui-widget-content ui-corner-all ui-state-default ui-state-hover ui-state-active").removeAttr("role");
			}
			$.Widget.prototype.destroy.apply(this);
		},
		upload : function() {
			if (this.options.disabled || this.has_started || this.file_queue.length === 0) {
				return;
			}
			this.has_started = true;
			this._dequeueFile();
		},
		abort : function(file) {
			if (this.current_xhr && (file === undefined || file.id == this.current_xhr.current_file.id)) {
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.ABORTED,
					file : this.current_xhr.current_file
				});
				// stop the upload
				this.current_xhr.abort();
				this.current_xhr = null;
			} else if (file) {
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.DEQUEUE,
					file : file
				});
				// remove from the queue
				var temp = [];
				$.each(this.file_queue, function(i, f) {
					if (f.id != file.id) {
						temp.push(f);
					}
				});
				this.file_queue = temp;
			}
		},
		queue : function(e, data) {
			var self = this, files;
			// no files passed in...
			if (!e.dataTransfer.files) {
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.NO_SUPPORT
				});
				return;
			}
			files = e.dataTransfer.files;
			// too many files!
			if (files.length + this.file_queue.length > this.options.maxFiles) {
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.MAX_QUEUE
				});
				return;
			}
			// queue up individual files
			$.each(files, function(i, file) {
				self._queueFile(file, data, e);
			});

			if (!this.has_started && this.options.autostart) {
				this.upload();
			}
		},
		requeue : function(file, data) {
			// too many files!
			if (this.file_queue.length + 1 > this.options.maxFiles) {
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.MAX_QUEUE
				});
				return;
			}
			// queue this file up
			this._queueFile(file, data, null);

			// start the upload if possible
			if (!this.has_started && this.options.autostart) {
				this.upload();
			}
		},
		maxSize : function() {
			return has_large_file_support ? this.options.largeMaxFileSize : this.options.maxFileSize;
		},
		_progress : function(e, file) {
			if (e.lengthComputable) {
				var percentage = Math.round((e.loaded * 100) / e.total);
				if (percentage <= 100) {
					this._trigger("progress", e, {
						file : file,
						value : percentage
					});
				}
			}
		},
		_send : function(file, xhr, xhrsend) {
			var self = this;
			try {
				var url = this.options.url, data = "";
				xhr.current_file = file;

				// we're going to try to bind the form data as get params
				if (this.options.data || file.form_data) {
					// merge all the possible data parameters, only allow objects as data
					data = $.param($.extend({}, this.options.data || {}, file.form_data || {}));

					// bind the data params
					url += (/\?/.test(url) ? "&" : "?") + data;
				}

				// bind the upload progress listener
				if (xhr.upload) {
					xhr.upload.addEventListener("progress", function(e) {
						self._progress(e, file);
					}, false);
				}

				xhr.open(this.options.method || "POST", url, true);

				if (this._trigger("beforeSend", null, {
					xhr : xhr,
					file : file
				}) === false) {
					xhr.abort();
					return;
				}

				xhrsend(file, xhr);
				this._trigger("start", null, {
					xhr : xhr,
					file : file
				});
				this.current_xhr = xhr;

				// bind the onload event
				xhr.onload = function() {
					self._xhrLoad(file, xhr);
				};
			} catch (err) {
				this.has_started = false;
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.NO_SUPPORT,
					file : file
				});
			}
		},
		_xhrLoad : function(file, xhr) {
			var self = this;
			this.has_started = false;
			try {
				if ($.ui.dropzone.httpSuccess(xhr)) {
					try {
						// continue the upload if success is ok
						if (this._trigger("success", null, {
							value : $.ui.dropzone.httpData(xhr, this.options.dataType),
							xhr : xhr,
							file : file
						}) !== false) {
							// push the next upload call to the end of the javascript stack
							setTimeout(function() {
								self.upload();
							}, 1);
						}
					} catch (err) {
						this._trigger("error", null, {
							error : $.ui.dropzone.errors.PARSE,
							file : file
						});
					}
				} else {
					this._trigger("error", null, {
						error : $.ui.dropzone.errors.REQUEST,
						file : file
					});
				}
			} catch (err_1) {
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.REQUEST,
					file : file
				});
			}
			this._trigger("complete", null, {
				file : file,
				xhr : xhr
			});
			this.current_xhr = null;
		},
		_queueFile : function(file, data, e) {
			try {
				file.id = this.options.prefix + (++$.ui.dropzone.uniq_id);
				file.form_data = data || this.options.fileData || {};
				if (file.size > (1048576 * this.maxSize())) {
					this._trigger("error", null, {
						error : $.ui.dropzone.errors.MAX_SIZE,
						file : file
					});
					return;
				}

				if (this._trigger("queue", e, {
					file : file
				}) === false) {
					return false;
				}
				this.file_queue.push(file);
			} catch (err) {
				this._trigger("error", null, {
					error : $.ui.dropzone.errors.NO_SUPPORT
				});
				return false;
			}
			return true;
		},
		_dequeueFile : function() {
			// check if this plugin is enabled
			if (this.options.disabled) {
				return;
			}
			// check if we're done
			if (this.file_queue.length === 0) {
				this.has_started = false;
				return;
			}
			var file = this.file_queue.shift(), self = this, xhr = new XMLHttpRequest(), content;

			// here we need to figure out xhr support!
			if (window.FormData) {
				// Firefox 4+ support for the FormData container
				this._send(file, xhr, function(file, xhr) {
					content = new FormData();
					content.append(self.options.name, file);
					xhr.send(content);
				});
			} else if (window.FileReader) {
				// Firefox 3.5+, Chrome 6, WebKit support for the FileReader object
				content = new FileReader();
				content.addEventListener("loadend", function(e) {
					self._send(file, xhr, function(file, xhr) {
						var boundary = "------multipartformboundary" + new Date().getTime();
						var form = buildForm(self.options.name, file.name, e.target.result, boundary);
						xhr.setRequestHeader("content-type", "multipart/form-data; boundary=" + boundary);
						if (xhr.sendAsBinary) {
							xhr.sendAsBinary(form);
						} else {
							xhr.send(form);
						}
					});
				}, false);
				content.addEventListener("error", function(e) {
					var error = $.ui.dropzone.errors.NOT_READABLE;
					switch (event.target.error.code) {
						case event.target.error.NOT_FOUND_ERR:
							error = $.ui.dropzone.errors.MISSING;
							break;
						case event.target.error.NOT_READABLE_ERR:
							error = $.ui.dropzone.errors.NOT_READABLE;
							break;
						case event.target.error.ABORT_ERR:
							error = $.ui.dropzone.errors.ABORTED;
							break;
					}
					this._trigger("error", null, {
						error : error,
						file : file
					});
				}, false);
				content.readAsBinaryString(file);
			} else {
				// Safari 5+ support for sending the file object
				this._send(file, xhr, function(file, xhr) {
					xhr.setRequestHeader("FILES-UPLOAD", 1);
					xhr.setRequestHeader("FILES-FILENAME", file.name);
					xhr.setRequestHeader("FILES-SIZE", file.size);
					xhr.setRequestHeader("FILES-TYPE", file.type);
					xhr.send(file);
				});
			}
		},
		_getEvents : function() {
			if (this.events === null) {
				var self = this, doc_leave_timer = null;
				this.events = {};
				this.events.element = {
					drop : function(e) {
						self._drop(e);
						e.preventDefault();
						e.stopPropagation();
						return false;
					},
					dragenter : function(e) {
						clearTimeout(doc_leave_timer);
						self._dragEnter(e);
						e.preventDefault();
					},
					dragover : function(e) {
						clearTimeout(doc_leave_timer);
						self._dragOver(e);
						e.preventDefault();
					},
					dragleave : function(e) {
						clearTimeout(doc_leave_timer);
						self._dragLeave(e);
						e.stopPropagation();
					}
				};
				this.events.document = {
					drop : function(e) {
						self._docLeave(e);
						e.preventDefault();
						return false;
					},
					dragenter : function(e) {
						clearTimeout(doc_leave_timer);
						self._docEnter(e);
						e.preventDefault();
						return false;
					},
					dragover : function(e) {
						clearTimeout(doc_leave_timer);
						self._docOver(e);
						e.preventDefault();
						return false;
					},
					dragleave : function(e) {
						doc_leave_timer = setTimeout(function() {
							self._docLeave(e);
						}, 200);
					}
				};
			}
			return this.events;
		},
		_drop : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragLeave", e, {});
				this._trigger("docLeave", e, {});

				// only queue if the drop function says it's ok
				if (this._trigger("drop", e, {}) !== false) {
					this.queue(e);
				}
			}
			this.element.removeClass("ui-state-hover");
			this.element.removeClass("ui-state-active");
			$("body").removeClass("ui-dropzone-hover");
		},
		_dragEnter : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragEnter", e, {});
				this.element.addClass("ui-state-hover");
			}
		},
		_dragOver : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragOver", e, {});
			}
		},
		_dragLeave : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragLeave", e, {});
			}
			this.element.removeClass("ui-state-hover");
		},
		_docDrop : function(e) {
			if (!this.options.disabled) {
				this._trigger("docDrop", e, {});
			}
		},
		_docEnter : function(e) {
			if (!this.options.disabled) {
				this._trigger("docEnter", e, {});
				this.element.addClass("ui-state-active");
				$("body").addClass("ui-dropzone-hover");
			}
		},
		_docOver : function(e) {
			if (!this.options.disabled) {
				this._trigger("docOver", e, {});
			}
		},
		_docLeave : function(e) {
			if (!this.options.disabled) {
				this._trigger("docLeave", e, {});
			}
			this.element.removeClass("ui-state-active");
			$("body").removeClass("ui-dropzone-hover");
		}
	});
	$.extend($.ui.dropzone, {
		uniq_id : 0,
		errors : {
			NO_SUPPORT : "BrowserNotSupported",
			MAX_QUEUE : "TooManyFiles",
			MAX_SIZE : "FileTooLarge",
			PARSE : "ParseError",
			REQUEST : "RequestError",
			ABORTED : "RequestStopped",
			DEQUEUE : "RemovedFromQueue",
			NOT_READABLE : "FileNotReadable",
			MISSING : "FileMissing"
		},
		httpSuccess : function(xhr) {
			// from jquery 1.4.4
			try {
				// IE error sometimes returns 1223 when it should be 204 so treat it as success, see #1450
				return !xhr.status && location.protocol === "file:" || xhr.status >= 200 && xhr.status < 300 || xhr.status === 304 || xhr.status === 1223;
			} catch (e) {
			}
			return false;
		},
		httpData : function(xhr, type, s) {
			// from jquery 1.4.4
			var ct = xhr.getResponseHeader("content-type") || "", xml = type === "xml" || !type && ct.indexOf("xml") >= 0, data = xml ? xhr.responseXML : xhr.responseText;

			if (xml && data.documentElement.nodeName === "parsererror") {
				jQuery.error("parsererror");
			}

			// Allow a pre-filtering function to sanitize the response
			// s is checked to keep backwards compatibility
			if (s && s.dataFilter) {
				data = s.dataFilter(data, type);
			}

			// The filter can actually parse the response
			if (typeof data === "string") {
				// Get the JavaScript object, if JSON is used.
				if (type === "json" || !type && ct.indexOf("json") >= 0) {
					data = jQuery.parseJSON(data);

					// If the type is "script", eval it in global context
				} else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
					jQuery.globalEval(data);
				}
			}

			return data;
		}
	});

	// helper widget for being able to queue to a dropzone from another element easily
	$.widget("ui.dropqueue", {
		widgetEventPrefix : "dropqueue",
		options : {
			target : null,
			data : null,
			drop : empty,
			dragEnter : empty,
			dragOver : empty,
			dragLeave : empty,
			disabled : false
		},
		events : null,
		_create : function() {
			// make sure we have the FileReader object before we do anything
			if (has_support) {
				var events = this._getEvents();
				// bind the drag/drop event handler to the element
				this.element[0].addEventListener("drop", events.drop, true);
				this.element.bind("dragenter." + this.widgetEventPrefix, events.dragenter).bind("dragover." + this.widgetEventPrefix, events.dragover).bind("dragleave." + this.widgetEventPrefix, events.dragleave);

				// add the jquery ui classes
				this.element.addClass("ui-dropqueue ui-state-default").attr({
					role : "dropqueue"
				});
			}
		},
		destroy : function() {
			if (has_support) {
				var events = this._getEvents();
				// unbind the drag/drop event handler to the element
				this.element[0].removeEventListener("drop", events.drop, true);
				this.element.unbind("dragenter." + this.widgetEventPrefix, events.dragenter).unbind("dragover." + this.widgetEventPrefix, events.dragover).unbind("dragleave." + this.widgetEventPrefix, events.dragleave);

				// remove the jquery ui classes
				this.element.removeClass("ui-dropqueue ui-state-default").removeAttr("role");
			}
			$.Widget.prototype.destroy.apply(this);
		},
		queue : function(e) {
			var target = $(this.options.target);
			if (this.options.disabled || !target.is(":ui-dropzone")) {
				return;
			}
			target.dropzone("queue", e, this.options.data);
		},
		_getEvents : function() {
			if (this.events === null) {
				var self = this;
				this.events = {
					drop : function(e) {
						self._drop(e);
						e.preventDefault();
						e.stopPropagation();
						return false;
					},
					dragenter : function(e) {
						self._dragEnter(e);
						e.preventDefault();
					},
					dragover : function(e) {
						self._dragOver(e);
						e.preventDefault();
					},
					dragleave : function(e) {
						self._dragLeave(e);
						e.stopPropagation();
					}
				};
			}
			return this.events;
		},
		_drop : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragLeave", e, {});

				// only queue if the drop function says it's ok
				if (this._trigger("drop", e, {}) !== false) {
					this.queue(e);
				}
				this.element.removeClass("ui-state-hover");
			}
		},
		_dragEnter : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragEnter", e, {});
				this.element.addClass("ui-state-hover");
			}
		},
		_dragOver : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragOver", e, {});
				this.element.addClass("ui-state-hover");
			}
		},
		_dragLeave : function(e) {
			if (!this.options.disabled) {
				this._trigger("dragLeave", e, {});
			}
			this.element.removeClass("ui-state-hover");
		}
	});
})(jQuery, document);