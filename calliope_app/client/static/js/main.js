var marker_clicked = false,
	set_loc_clicked = 1, // toggle between 1 and 2 -- when loc clicked on map, set this loc dropdown
	map = null,
	active_lt_ids = [],
	loc_techs = [],
	markers = [],
	placeholder_text,
	map_mode;

$(function() {
	$(".alert-info,.alert-success").fadeTo(3000, 500).slideUp(500, function() {
		$(this).slideUp(500);
	});
})

$(document).ready(function() {

	// Panel Resizing
	splitter_resize();

	// Configuration Tabs
	open_tab();
	$('.tab').on('mousedown', function() {
		var tab = $(this).attr('data-type');
		open_tab(tab);
	});

	// Unsaved Changes Warning
    window.addEventListener("beforeunload", function (e) {
		if ($('tr[data-dirty=true]').length == 0) return(undefined);
        var message = 'WARNING! Some locations are unsaved. If you leave this page, these changes will be lost.';
        (e || window.event).returnValue = message;
        return message;
    });

    // Units
    initiate_units();

})

function open_tab(tab) {
	$('#dashboard').children().hide();
	if (tab == undefined) { tab = localStorage['tab'] || undefined };
	if (tab == undefined) { return false };
	if (tab == 'locations') {
		pull_locations();
	} else if (tab == 'technologies') {
		pull_technologies();
	} else if (tab == 'scenarios') {
		pull_scenarios();
	};
	localStorage['tab'] = tab;
	$('.tab').removeClass('tab-active');
	$('.tab[data-type="' + tab + '"]').addClass('tab-active');
}

function activate_table() {

	$('.parameter-value.float-value').each(function() {
		autocomplete_units(this);
	});

	// Detection of unsaved changes
	$('.parameter-value-new, .parameter-value-existing, .parameter-year-existing').unbind();
	$('.parameter-value-new, .parameter-value-existing, .parameter-year-existing').on('focusout', function() {
		if ($(this).val() == '') { $(this).val( $(this).data('value') ) };
	});
	$('.parameter-value-new, .parameter-value-existing, .parameter-year-existing').on('change keyup paste', function() {
		var row = $(this).parents('tr'),
			year = row.find('.parameter-year').val(),
			old_year = row.find('.parameter-year').data('value'),
			value = row.find('.parameter-value').val(),
			old_value = row.find('.parameter-value').data('value'),
			param_id = $(this).parents('tr').data('param_id'),
			ts_id = row.find('.parameter-value.timeseries').val();
		// Convert to number if possible
		if (+value) { value = +value };
		if (+old_value) { old_value = +old_value };
		// If it is a timeseries: render the charts
		if (ts_id) {
			activate_charts(param_id, ts_id)
		};
		// Reset the formatting of row
		row.find('.parameter-reset').addClass('hide')
		row.find('.parameter-delete, .parameter-value-delete').removeClass('hide')
		row.removeClass('table-warning');
		$(this).removeClass('invalid-value');

		// Update Row based on Input
		var update_val = (value != '') & (value != old_value),
			update_year = (year != '') & (year != old_year);
		if (update_val & ($(this).hasClass('float-value') == true)) {
			var units = row.find('.parameter-units').data('value'),
				val = convert_units(value, units);
			if (typeof(val) == 'number') {
				$(this).attr('data-target_value', formatNumber(val, false));
				row.find('.parameter-target-value').html(formatNumber(val, true));
				row.find('.parameter-reset').removeClass('hide')
				row.find('.parameter-delete, .parameter-value-delete').addClass('hide')
				row.addClass('table-warning');
			} else {
				$(this).addClass('invalid-value');
				row.find('.parameter-target-value').html(row.find('.parameter-target-value').data('value'));
			}
		} else if (update_val || update_year) {
			row.find('.parameter-reset').removeClass('hide')
			row.find('.parameter-delete, .parameter-value-delete').addClass('hide')
			row.addClass('table-warning');
		} else {
			row.find('.parameter-target-value').html(row.find('.parameter-target-value').data('value'));
		}
		check_unsaved();
	});
	// Paste multiple values
	activate_paste('.dynamic_value_input');
	activate_paste('.dynamic_year_input');

	// Reset parameter to saved value in database
	$('.parameter-reset').unbind();
	$('.parameter-reset').on('click', function() {
		var row = $(this).parents('tr'),
			value_field = row.find('.parameter-value'),
			old_value = value_field.data('value'),
			year_field = row.find('.parameter-year'),
			old_year = year_field.data('value'),
			param_id = $(this).parents('tr').data('param_id'),
			ts = row.find('.parameter-value-existing.timeseries'),
			ts_id = ts.data('ts_id');
		if (ts_id != undefined) {
			// Timeseries Fields
			ts.val(+ts_id);
			activate_charts(param_id, +ts_id)
		} else {
			// Input Fields
			value_field.val(old_value);
			year_field.val(old_year);
		};
		value_field.change();
		check_unsaved();
	});

	// Delete parameter from database
	$('.parameter-delete').unbind();
	$('.parameter-delete').on('click', function() {
		var row = $(this).parents('tr'),
			param_id = row.data('param_id'),
			rows = $('tr[data-param_id='+param_id+']');
		if (row.hasClass('table-danger')) {
			rows.find('.check_delete').prop("checked", false)
			rows.removeClass('table-danger');
			rows.find('.parameter-value, .parameter-year').prop('disabled', false);
			change_timeseries_color(param_id, true);
		} else {
			rows.find('.check_delete').prop("checked", true)
			rows.addClass('table-danger');
			rows.find('.parameter-value, .parameter-year').prop('disabled', true)
			change_timeseries_color(param_id, false);
		}
		check_unsaved();
	});
	$('.parameter-value-delete').unbind();
	$('.parameter-value-delete').on('click', function() {
		var row = $(this).parents('tr');
		if (row.hasClass('table-danger')) {
			row.find('.check_delete').prop("checked", false)
			row.removeClass('table-danger');
			row.find('.parameter-value, .parameter-year').prop('disabled', false);
		} else {
			row.find('.check_delete').prop("checked", true)
			row.addClass('table-danger');
			row.find('.parameter-value, .parameter-year').prop('disabled', true)
		};
		check_unsaved();
	});

	// Timeseries
	$('.convert-to-timeseries').on('click', function() {
		var confirmation = confirm('Converting parameter to timeseries...\nAny unsaved changes will be lost.\nContinue?');
		if (confirmation) {
			var model_uuid = $('#header').data('model_uuid'),
				row = $(this).parents('tr'),
				param_id = row.data('param_id'),
				technology_id = $("#technology option:selected").data('id'),
				loc_tech_id = $('tr.loc_tech_row.table-primary').data('loc_tech_id');
			$.ajax({
				url: '/' + LANGUAGE_CODE + '/api/convert_to_timeseries/',
				data: {
				  'model_uuid': model_uuid,
				  'param_id': +param_id,
				  'technology_id': +technology_id,
				  'loc_tech_id': +loc_tech_id,
				},
				dataType: 'json',
				success: function (data) {
					window.onbeforeunload = null;
					location.reload();
				}
			});
		}
	});

	// Model favorites
	$('.fa-star').unbind();
	$('.fa-star').on('click', function() {
		if ($(this).is("[disabled]") == false) {
			toggle_favorite($(this), true);
		};
	});

	// Allow 'return' key to tab through input cells
	activate_return('.static_inputs');
	activate_return('.dynamic_year_input');
	activate_return('.dynamic_value_input');
	
	// Show and Hide the parameter rows
	$('.param_row_toggle').unbind();
	$('.param_row_toggle').on('click', function() {
		var param_id = $(this).parents('tr').data('param_id');
		param_row_toggle(param_id, false);
	});
	// Show parameter rows and append another row
	$('.parameter-value-add').unbind();
	$('.parameter-value-add').on('click', function() {
		$(this).parents('tr').find('.parameter-target-value').html('');
		add_row($(this));
	});
	// Drop parameter row
	$('.parameter-value-remove').unbind();
	$('.parameter-value-remove').on('click', function() {
		var row = $(this).parents('tr');
		row.remove();
		check_unsaved();
	});

	// Select all on text input focus
	$("input:text").focus(function() { 
		$(this).select(); 
	});

	$('.header-collapsable').unbind();
	$('.header-collapsable').on('click', function(){
		var rows = $(this).nextUntil('.header-collapsable');
		if ($(this).hasClass('hiding_rows')) {
			rows.removeClass('hide');
			$(this).removeClass('hiding_rows');
			$(this).find('.fa-caret-up').removeClass('hide');
			$(this).find('.fa-caret-down').addClass('hide');
		} else {
			rows.addClass('hide');
			$(this).addClass('hiding_rows');
			$(this).find('.fa-caret-up').addClass('hide');
			$(this).find('.fa-caret-down').removeClass('hide');
		}
	});

	$(function () {
	  $('[data-toggle="tooltip"]').tooltip()
	});

}


function collapse_parameter_library() {
	var rows = ($('.header-collapsable').first()).nextAll().not('.header-collapsable');
	$('.header-collapsable').addClass('hiding_rows')
	rows.addClass('hide')
}


function param_row_toggle(param_id, expand_only) {
	var row = $('tr[data-param_id='+param_id+']');
	if (expand_only || $('.param_row_'+param_id).hasClass('param_row_min')) {
		$('.param_row_'+param_id).removeClass('param_row_min');
		row.find('.view_rows').addClass('hide');
		row.find('.hide_rows').removeClass('hide');
		activate_charts(param_id, row.find('.parameter-value-existing.timeseries').val());
	} else {
		$('.param_row_'+param_id).addClass('param_row_min');
		row.find('.view_rows').removeClass('hide');
		row.find('.hide_rows').addClass('hide');
	};
};

function get_loc_techs() {
	var model_uuid = $('#header').data('model_uuid'),
		technology_id = $("#technology option:selected").data('id');

	if (technology_id != undefined) {
		$.ajax({
			url: '/' + LANGUAGE_CODE + '/component/all_loc_techs/',
			data: {
			  'model_uuid': model_uuid,
			  'technology_id': technology_id,
			},
			dataType: 'json',
			success: function (data) {
				if (map) map = null;

				loc_techs = data['loc_techs'];
				
				$('#tech_essentials').html(data['html_essentials']);
				$('#tech_essentials').data('technology_id', data['technology_id']);
				$('.loc_tech_row').on('click', function() {
					$('.loc_tech_row').removeClass('table-primary')
					$(this).addClass('table-primary')
					get_loc_tech_parameters();
				});
				
				$('#loc_tech-add-1, #loc_tech-add-2').on('change', function() {
					var id = $(this).val();
					blink_location(id, 'marker', true);
				});
				
				$('.loc_tech-add').on('click', function() {
					var loc_1_id = $('#loc_tech-add-1').val(),
						loc_2_id = $('#loc_tech-add-2').val();
					if (loc_1_id != loc_2_id) {
						$.ajax({
							url: '/' + LANGUAGE_CODE + '/api/add_loc_tech/',
							type: 'POST',
							data: {
								'model_uuid': $('#header').data('model_uuid'),
								'technology_id': $("#technology option:selected").data('id'),
								'location_1_id': $('#loc_tech-add-1').val(),
								'location_2_id': $('#loc_tech-add-2').val(),
								'csrfmiddlewaretoken': getCookie('csrftoken'),
							},
							dataType: 'json',
							success: function (data) {
								window.onbeforeunload = null;
								location.reload();
							}
						});
					} else {
						alert('Please select the location(s) to add.');
					};
				});
				$('.loc_tech-delete').on('click', function() {
					var model_uuid = $('#header').data('model_uuid'),
						loc_tech_id = $(this).parents('tr.loc_tech_row').data('loc_tech_id');
					var confirmation = confirm('This will remove all parameter settings for this node.\nAre you sure you want to delete?');
					if (confirmation) {
						$.ajax({
							url: '/' + LANGUAGE_CODE + '/api/delete_loc_tech/',
							type: 'POST',
							data: {
								'model_uuid': model_uuid,
								'loc_tech_id': loc_tech_id,
								'csrfmiddlewaretoken': getCookie('csrftoken'),
							},
							dataType: 'json',
							success: function (data) {
								window.onbeforeunload = null;
								location.reload();
							}
						});
					};
				});
				var list_position = $('tr.loc_tech_row.table-primary').position();
				if (list_position) {
					$('.location-list').animate( { scrollTop: list_position.top }, 500 )
				};
				get_loc_tech_parameters();
			}
		});
	} else {
		$('#tech_essentials').html("");
		get_loc_tech_parameters();
	};
};

function get_loc_tech_parameters() {
	var model_uuid = $('#header').data('model_uuid'),
		loc_tech_id = $('tr.loc_tech_row.table-primary').data('loc_tech_id'),
		technology_id = $("#technology option:selected").data('id');

	if (loc_tech_id != undefined) {
		$.ajax({
			url: '/' + LANGUAGE_CODE + '/component/all_loc_tech_params/',
			data: {
			  'model_uuid': model_uuid,
			  'loc_tech_id': loc_tech_id,
			},
			dataType: 'json',
			success: function (data) {
				$('#tech_parameters').html(data['html_parameters']);
				$('#tech_parameters').data('favorites', data['favorites']);
				activate_table();
				activate_favorites();
				collapse_parameter_library();
				check_unsaved();
				retrieve_map(false, undefined, technology_id, loc_tech_id);
			}
		});
	} else {
		var msg = '<div class="col-12 centered"><br><br><h4>Please select or create a node.</h4></div>'
		$('#tech_parameters').html(msg);
		retrieve_map(false, undefined, technology_id);
	};
};


function activate_charts(param_id, ts_id) {

	var model_uuid = $('#header').data('model_uuid'),
		div_id = 'chart-'+param_id;

	if (ts_id > 0) {
		if ($('#'+div_id).length > 0) {
			
			draw_charts(div_id, ['2019-07-24'], [0]);
			
			$('#' + div_id).attr('model_uuid', model_uuid);
			$('#' + div_id).attr('ts_id', ts_id);
			$('#' + div_id).attr('param_id', param_id);
			
			$('#' + div_id + ' .loader-container').show();
			
			$.ajax({
				url: '/' + LANGUAGE_CODE + '/component/timeseries_view/',
				data: {
					'model_uuid': model_uuid,
					'ts_id': ts_id,
				},
				dataType: 'json',
				success: function (data) {
					draw_charts(div_id, data['timestamps'], data['values']);
					$('#timeseries-placeholder').hide();
				}
			});
		};
	};
}

function draw_charts(div_id, x, y) {

	var data = [{
		type: "scatter",
		mode: "lines",
		x: x,
		y: y,
		fill: 'tozeroy',
	}]
	
	var layout = {
		xaxis: {
			autorange: true,
			type: 'date'
		},
		yaxis: {
			autorange: true,
			type: 'linear',
		},
		dragmode: $('#' + div_id).attr('dragmode'),
		height: 280,
		margin: {l:60,r:25,t:10,b:40,pad:10},
		showlegend: false,
	};

	var config = {};

	Plotly.newPlot( div_id, data, layout, config);
	
	
	if ($('#' + div_id).find('.loader').length < 1) {
		$('#' + div_id).append('<div class="loader-container"><div class="loader"></div></div>');
	}
	
	
	$('#' + div_id + ' .loader-container').hide();
	
	var start_date = x[0].substring(0, 10);
	var end_date = x[x.length - 1].substring(0, 10);
	if (end_date < start_date) {
		var tmp_date = start_date;
		start_date = end_date;
		end_date = tmp_date;
	}
	$('#' + div_id).attr('start_date', start_date);
	$('#' + div_id).attr('end_date', end_date);
	
	$('#' + div_id + ' a.modebar-btn[data-attr=zoom][data-val=auto]').on('click', function(data) {
		// var model_uuid = $('#' + div_id).attr('model_uuid');
		var ts_id = $('#' + div_id).attr('ts_id');
		var param_id = $('#' + div_id).attr('param_id');
		activate_charts(param_id, ts_id);
	});
	
	$('#' + div_id).on('plotly_relayout', function(data) {
		
		var range = data.target.layout.xaxis.range;
		var dragmode = data.target.layout.dragmode;
		var start_date = range[0].substring(0, 10);
		var end_date = range[1].substring(0, 10);
		if (end_date < start_date) {
			var tmp_date = start_date;
			start_date = end_date;
			end_date = tmp_date;
		}
		if (start_date != $(this).attr('start_date') || end_date != $(this).attr('end_date')) {
			
			$('#' + div_id + ' .loader-container').show();
			
			$(this).attr('start_date', start_date);
			$(this).attr('end_date', end_date);
			$(this).attr('dragmode', dragmode);
			var model_uuid = $(this).attr('model_uuid');
			var ts_id = $(this).attr('ts_id');
			
			$.ajax({
				url: '/' + LANGUAGE_CODE + '/component/timeseries_view/',
				data: {
					'model_uuid': model_uuid,
					'ts_id': ts_id,
					'start_date': start_date,
					'end_date': end_date,
					// 'start_date': start_date.getFullYear() + '-' + (start_date.getMonth() + 1).toString().padStart(2, '0') + '-' + start_date.getDate(),
					// 'end_date': end_date.getFullYear() + '-' + (end_date.getMonth() + 1).toString().padStart(2, '0') + '-' + end_date.getDate(),
				},
				dataType: 'json',
				success: function (data) {
					draw_charts(div_id, data['timestamps'], data['values'])
				}
			});
		}
	});

}

function change_timeseries_color(param_id, mark_delete) {
	if (mark_delete == true) {
		var update = {
		    'marker.color': ['#1f77b4']
		};
	} else {
		var update = {
		    'marker.color': ['#f5c6cb']
		};
	}
	var div_id = 'chart-'+param_id;
	if ($('#'+div_id).length > 0) {
		if (!$('#'+div_id).is(':empty')) {
			Plotly.restyle(div_id, update, [0])
		};
	};
}

function retrieve_map(draggable, scenario_id, technology_id, loc_tech_id) {
	render_basemap();
	if ($('#map').length) {
		var model_uuid = $('#header').data('model_uuid');
		
		$.ajax({
			url: '/' + LANGUAGE_CODE + '/component/location_coordinates/',
			data: {
				'model_uuid': model_uuid,
				'scenario_id': scenario_id,
				'technology_id': technology_id,
				'loc_tech_id': loc_tech_id,
			},
			dataType: 'json',
			success: function (data) {
				// assign locations to global variable:
				locations = data['locations'];
				load_map(locations, data['transmissions'], draggable, loc_tech_id);
			}
		});
	};

}

function blink_element(ele, n) {
	if (typeof n !== 'number') n = 2;
	var delay = 70;
	for (var i = 0; i < n; i ++) {
		ele.delay(delay).animate({ opacity: 0 }, 0)
			.delay(delay).animate({ opacity: 1.0 }, 0);
	}
}

function set_location(id) {
	var select = $('#loc_tech-add-' + set_loc_clicked.toString());
	if (select.length == 1) {
		select.val(id);
		blink_element(select);
	}
}

function blink_location(id, what_to_blink, pan_to_marker) {
	setTimeout(function() {
		if (typeof what_to_blink === 'undefined') what_to_blink = 'both';
		if (typeof pan_to_marker === 'undefined') pan_to_marker = false;
		var marker = markers.find(function(m) {
			return m.id == id;
		});
		var ele = marker.getElement();
		
		if (what_to_blink == 'marker' || what_to_blink == 'both') {
			blink_element($(ele));
			if (pan_to_marker) {
				map.once('moveend', function() {
					blink_element($(ele));
				});
				map.flyTo({
					center: marker.getLngLat(),
					zoom: map.getZoom(),
					duration: 750
				});
			}
		}
		
		if (what_to_blink == 'row' || what_to_blink == 'both') {
			var row = $('#location_table tr[data-location_id="' + id + '"]');
			if ($('#locations_dashboard').length > 0) {
				$('#locations_dashboard').animate({
					scrollTop: row.position().top
				}, {
					duration: 500,
					complete: function() {
						blink_element(row);
					}
				});
			};
		}
	}, 10);
}

function add_marker(name, id, type, draggable, coordinates) {
	var description = '<h4>' + name + '</h4>';
	if (typeof loc_techs !== 'undefined') {
		var has_techs = false;
		var has_trans = false;
		var techs_html = '';
		var trans_html = '<hr>';
		for (var i = 0; i < loc_techs.length; i ++) {
			if (!active_lt_ids.includes(loc_techs[i].id)) { continue };
			if (name == loc_techs[i].location_1 || name == loc_techs[i].location_2) {
				if (loc_techs[i].location_2 == null) {
					has_techs = true;
					techs_html += '<br><span style="color: ' + loc_techs[i].color + '; padding-right: 10px;">' + loc_techs[i].icon + '</span>' + loc_techs[i].technology;
				} else {
					has_trans = true;
					if (loc_techs[i].location_2 == name) { var loc = loc_techs[i].location_1 } else { var loc = loc_techs[i].location_2 };
					trans_html += '<span style="color: ' + loc_techs[i].color + '; padding-right: 10px;">' + loc_techs[i].icon + '</span>' + loc_techs[i].technology + '&nbsp;&rarr;&nbsp;' + loc + '<br>';
				}
			}
		}
		if (has_techs || has_trans) {
			description += techs_html;
			if (has_trans) description += trans_html;
		}
	}
	var el = document.createElement('div');
	el.className = 'marker ' + type;
	if (dark_styles.includes(map_style)) {
		el.className += ' dark';
	}
	var marker = new mapboxgl.Marker(el)
		.setDraggable(draggable)
		.setLngLat(coordinates)
		.addTo(map);
	marker.id = id;
	marker.el = el;
	marker.lat = coordinates[0];
	marker.lon = coordinates[1];
	marker.name = name;
	marker.description = description;
	marker._element._marker = marker;
	marker._element.addEventListener('mouseenter', function(e) {
		var m = e.target._marker;
		$('#map-legend').html(m.description);
	});
	marker._element.addEventListener('mouseleave', function(e) {
		$('#map-legend').html("");
	});
	marker._element.addEventListener('mouseup', function(e) {
		var m = e.target._marker;
		setTimeout(function() {
			set_location(m.id);
			blink_location(m.id, 'row');
			if ($('#loc_tech-add-2').length == 1 && set_loc_clicked == 1) {
				set_loc_clicked = 2;
			} else {
				set_loc_clicked = 1;
			}
		}, 20);
	});
	marker._element.addEventListener('click', function(e) {
		splitter_reset();
		// Filter the Locations on the Scenarios Tab
		e.stopPropagation();
		var m = e.target._marker;
		if ($('#location-filter').length > 0) {
			$('#location-filter').val(m.name);
			filter_nodes();
		};
	});
	markers.push(marker);
	if (draggable) {
		marker.on('up', false);
		marker.on('dragstart', function(e) {
			this.old_pos = this._pos;
			var lnglat = this.getLngLat();
			this.lat = lnglat.lat;
			this.lon = lnglat.lng;
		});
		marker.on('dragend', function(e) {
			$('#map canvas').css('cursor', '');
			marker_clicked = true;
			
			var that = this;
			var marker = e.target;
			var new_lnglat = marker.getLngLat();
			var new_pos = marker._pos;
			var old_pos = marker.old_pos;
			var dist = Math.sqrt((new_pos.x - old_pos.x)**2 + (new_pos.y - old_pos.y)**2);
			
			if (dist < 4) {
				setTimeout(function() {
					blink_location(marker.id, 'row');
					marker.setLngLat([marker.lon, marker.lat]);
				}, 20);
			} else {
				blink_location(marker.id);
				toggle_location_edit(marker.id, true);
				var row = $("tr[data-location_id='" + marker.id + "']");
				row.find('.location-edit-lat').val(new_lnglat.lat.toFixed(5))
				row.find('.location-edit-long').val(new_lnglat.lng.toFixed(5))
				marker.lat = new_lnglat.lat;
				marker.lon = new_lnglat.lng;
			}
			
			setTimeout(function() {
				// $('#map canvas').css('cursor', 'crosshair');
				marker_clicked = false;
			}, 500);
		});
	};
	return marker;
}

var mapbox_styles = {
	'Dark': 'mapbox/dark-v10',
	'Light': 'mapbox/light-v10',
	'Streets': 'mapbox/streets-v11',
	'Satellite': 'mapbox/satellite-v9',
	'Satellite + Streets': 'mapbox/satellite-streets-v9'
};
var dark_styles = ["mapbox/dark-v10", "mapbox/satellite-v9", "mapbox/satellite-streets-v9"];

var map_style = localStorage.getItem("mapstyle") || Object.values(mapbox_styles)[0];

function changeMapStyle() {
    map_style = $('#map-style').val();
    localStorage.setItem("mapstyle", map_style);
    map.setStyle('mapbox://styles/' + map_style);
	if (dark_styles.includes(map_style)) {
		$('.marker').addClass('dark');
	} else {
		$('.marker').removeClass('dark');
	};
}

function MapStyleControl() { }

MapStyleControl.prototype.onAdd = function(map) {
	this._map = map;
	this._container = document.createElement('div');
	this._container.className = 'mapboxgl-ctrl';
	var select = document.createElement('select');
	select.id = 'map-style';
	var mapbox_style_keys = Object.keys(mapbox_styles),
		mapbox_style_values = Object.values(mapbox_styles);
	for (var i = 0; i < mapbox_style_keys.length; i ++) {
		$(select).append($('<option/>')
			  .val(mapbox_style_values[i])
			  .text(mapbox_style_keys[i]));
	}
	$(select).val(map_style);
	$(select).change(changeMapStyle);
	this._container.append(select);
	return this._container;
}

MapStyleControl.prototype.onRemove = function() {
	this._container.parentNode.removeChild(this._container);
	this._map = undefined;
}


function load_map(locations, transmissions, draggable, loc_tech_id) {
	// Locations
	map.fitBounds(get_bounds(locations)[0]);
	if (typeof markers !== 'undefined') {
		markers.forEach(function(m) { m.remove() });
	}
	markers = [];
	for (var i = 0; i < locations.length; i++) {
		var coordinates = [locations[i]['longitude'], locations[i]['latitude']];
		var type = locations[i]['type'];
		if (typeof map_mode !== 'undefined' && map_mode == 'locations') type = '';
		add_marker(locations[i].pretty_name, locations[i]['id'], type, draggable, coordinates);
	};
	// Transmission
	var active_trans = [], inactive_trans = [];
	if (transmissions.length == 0) {
		loc_techs.filter(function(lt) {
				return lt.location_2_id != null;
			}).map(function(lt) {
				var loc_1 = locations.find(function(l) {
					return l.id == lt.location_1_id;
				});
				var loc_2 = locations.find(function(l) {
					return l.id == lt.location_2_id;
				});
				
				var coords = [
					[loc_1.longitude, loc_1.latitude],
					[loc_2.longitude, loc_2.latitude]
				];
				
				if (lt.id == loc_tech_id) {
					active_trans.push(coords);
				} else {
					inactive_trans.push(coords);
				}
			});
	} else {
		active_trans = transmissions.map(function(t) {
			return [[t.lon1, t.lat1], [t.lon2, t.lat2]];
		});
	}
	
	var trans_data = {
		"type": "FeatureCollection",
		"features": [
			{
				"type": "Feature",
				"properties": {
					"color": "#88f",
					"width": 4
				},
				"geometry": {
					"type": "MultiLineString",
					"coordinates": active_trans
				}
			}
		]
	};
	
	if (inactive_trans.length > 0) {
		trans_data["features"].push({
			"type": "Feature",
			"properties": {
				"color": "grey",
				"width": 3
			},
			"geometry": {
				"type": "MultiLineString",
				"coordinates": inactive_trans
			}
		});
	}
	
	if (typeof map.getSource('transmission') === 'undefined') {
		map.addLayer({
			id: "transmission",
			source: {
				type: "geojson",
				data: trans_data
			},
			type: "line",
			paint: {
				'line-width': ['get', 'width'],
				'line-color': ['get', 'color']
			}
		});
	} else {
		map.getSource('transmission').setData(trans_data);
	}
	$('.viz-spinner').hide();
	
}

function get_bounds(locations) {
	var lvar = 'Bounds: ' + get_model_name(),
		bounds = JSON.parse(window.localStorage.getItem(lvar)),
		padding = 0;
	if ((locations != undefined) && (locations.length > 0)) {  // Center on global extent by default
		coords = locations.map(function(l) {
			return [l.longitude, l.latitude];
		});
	} else {
		coords = [[-180, -90], [180, 90]];
	}
	outerbounds = coords.reduce(
		function(bounds, coord) {
			return bounds.extend(coord);
		}, new mapboxgl.LngLatBounds(coords[0], coords[0]))
	if ((bounds == null) || (lvar == 'Bounds: Home')) {
		bounds = outerbounds;
		padding = 50;
	} else {
		var sw = new mapboxgl.LngLat(bounds['_sw']['lng'], bounds['_sw']['lat']),
			ne = new mapboxgl.LngLat(bounds['_ne']['lng'], bounds['_ne']['lat']);
		bounds = new mapboxgl.LngLatBounds(sw, ne);
	}
	return [bounds, padding];
}

function render_basemap() {
	if (map === null) {
		console.log('render_basemap')
		// Create Map
		var [bounds, padding] = get_bounds();
		map = new mapboxgl.Map({
				container: 'map',
				style: 'mapbox://styles/' + map_style,
				attributionControl: false,
				bounds: bounds
			})
			.addControl(new mapboxgl.AttributionControl({
				compact: true
			}))
			.addControl(new MapStyleControl())
			.addControl(new ExtentToggle({bounds: outerbounds}))
			.addControl(new mapboxgl.NavigationControl())
			.addControl(new PitchToggle());

		// On Load
		map.on('load', function() {
			map.addSource('mapbox-dem', {
				'type': 'raster-dem',
				'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
				'tileSize': 512,
				'maxzoom': 14
			});
			map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
			map.addLayer({
				'id': 'sky',
				'type': 'sky',
				'paint': {
					'sky-type': 'atmosphere',
					'sky-atmosphere-sun': [0.0, 0.0],
					'sky-atmosphere-sun-intensity': 15
				}
			});
			var camera = map.cameraForBounds(bounds, {
				padding: padding,
				maxZoom: 15
			});
			map.jumpTo(camera);
		});
		map.on('click', function() {
			if ($('#location-filter').length > 0) {
				$('#location-filter').val("");
				filter_nodes();
			};
		})
		map.on('moveend', function() {
			var lvar = 'Bounds: ' + get_model_name();
			window.localStorage.setItem(lvar, JSON.stringify(map.getBounds()));
		});
	}
}

function placeholder_blinker() {

	if (placeholder_text == undefined) {
		placeholder_text = $('input.nav-dropdown[type=text]').attr('placeholder')
	}
	if ($('input.nav-dropdown[type=text]').attr('placeholder')) {
		$('input.nav-dropdown[type=text]').attr('placeholder', '');
	} else {
		$('input.nav-dropdown[type=text]').attr('placeholder', placeholder_text);
	}

	setTimeout(placeholder_blinker, 1000);

}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function formatNumber(x, commas) {

    var parts = x.toString().split(".");
    if (commas == true) {
    	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
    if (parts.length > 1) {
    	if (parts[1].length > 3) { parts[1] = parts[1].slice(0, 3) };
    };
    return parts.join(".");

}

var maximize_label = '<i class="fas fa-chevron-up"></i>&nbsp;&nbsp;&nbsp;Show',
	minimize_label = '<i class="fas fa-chevron-down"></i>&nbsp;&nbsp;&nbsp;Hide',
	minimize_threshold = 0.1;

function splitter_resize() {
	var upper = $('.splitter_upper'),
		lower = $('.splitter_lower');
	$('#splitter').unbind('mousedown')
	$('#splitter').on('mousedown', function(e) {
		e.stopPropagation();
		var md = {e, upperHeight: upper.outerHeight(),
			      lowerHeight: lower.outerHeight()};
		$(document).unbind('mousemove');
		$(document).on('mousemove', function (e) {
			var delta = Math.min(Math.max((e.clientY - md.e.clientY), -md.upperHeight), md.lowerHeight),
				totalHeight = md.upperHeight + md.lowerHeight,
				upperHeight = (100 * (md.upperHeight + delta) / totalHeight);
			upper.css('height', (upperHeight) + '%');
			lower.css('height', (100 - upperHeight) + '%');
			if (lower.height() / totalHeight > minimize_threshold){
				$('#splitter_btn .content').html(minimize_label);
			} else {
				$('#splitter_btn .content').html(maximize_label);
			}
		});
		$(document).unbind('mouseup');
		$(document).on('mouseup', function () {
			$(this).unbind('mousemove mouseup');
			if (map != undefined) { map.resize() };
		});
	});
	$('#splitter_btn').unbind('mousedown');
	$('#splitter_btn').on('mousedown', function(e) { e.stopPropagation() });
	$('#splitter_btn').unbind('click');
	$('#splitter_btn').on('click', function() {
		splitter_toggle();
	});
}

function splitter_toggle() {
	var upper = $('.splitter_upper'),
		lower = $('.splitter_lower');
	if ((lower.height() / (lower.height() + upper.height())) > minimize_threshold){
		// Minimize Lower Row
		upper.css('height', '99%');
		lower.css('height', '1%');
		$('#splitter_btn .content').html(maximize_label);
	} else{
		// Expand Lower Row
		upper.css('height', '50%');
		lower.css('height', '50%');
		$('#splitter_btn .content').html(minimize_label);
	}
	if (map != undefined) { map.resize() };
}

function splitter_reset() {
	var upper = $('.splitter_upper'),
		lower = $('.splitter_lower');
	if ((lower.height() / (lower.height() + upper.height())) <= minimize_threshold){
		upper.css('height', '50%');
		lower.css('height', '50%');
		$('#splitter_btn .content').html(minimize_label);
	}
	if (map != undefined) { map.resize() };
}

function get_model_name() {
	return document.title.split(' | ')[1]
}

function get_tab_name() {
	return document.title.split(' | ')[2]
}

class PitchToggle {
  constructor() {
    this._bearing = -10;
    this._pitch = 50;
    this._minpitchzoom = 11;
  }
  onAdd(map) {
    this._map = map;
    let _this = this;
    this._btn = document.createElement("button");
    this._btn.className = "mapboxgl-ctrl-icon mapboxgl-ctrl-pitchtoggle-3d";
    this._btn.type = "button";
    this._btn["aria-label"] = "Toggle Pitch";
    this._btn.onclick = function() {
      if (map.getPitch() === 0) {
        let options = { pitch: _this._pitch, bearing: _this._bearing };
        if (_this._minpitchzoom && map.getZoom() > _this._minpitchzoom) {
          options.zoom = _this._minpitchzoom;
        }
        map.easeTo(options);
        _this._btn.className = "mapboxgl-ctrl-icon mapboxgl-ctrl-pitchtoggle-2d";
      } else {
        map.easeTo({ pitch: 0, bearing: 0 });
        _this._btn.className = "mapboxgl-ctrl-icon mapboxgl-ctrl-pitchtoggle-3d";
      }
    };
    this._container = document.createElement("div");
    this._container.className = "mapboxgl-ctrl-group mapboxgl-ctrl";
    this._container.appendChild(this._btn);
    return this._container;
  }
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

class ExtentToggle {
  constructor({ bounds = null }) {
    this._bounds = bounds;
  }
  onAdd(map) {
    this._map = map;
    let _this = this;
    this._btn = document.createElement("button");
    this._btn.className = "mapboxgl-ctrl-fullscreen";
    this._btn.type = "button";
    this._btn["aria-label"] = "Reset Extent";
    this._span = document.createElement("span");
    this._span.className = "mapboxgl-ctrl-icon";
    this._btn.appendChild(this._span);
    this._btn.onclick = function() {
		var camera = map.cameraForBounds(_this._bounds, {
			padding: 50,
			maxZoom: 15
		});
		map.jumpTo(camera);
    };
    this._container = document.createElement("div");
    this._container.className = "mapboxgl-ctrl-group mapboxgl-ctrl";
    this._container.appendChild(this._btn);
    return this._container;
  }
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

function build_selector(type, data) {
	$(".nav-dropdown").html("");
	if (data == undefined) {
		data = [];
		$(".nav-dropdown").attr('disabled', true);
	} else {
		$(".nav-dropdown").attr('disabled', false);
		var session_id = localStorage[type + '_id'] || null;
		if ((session_id == null) && (data.length > 0)) {
			localStorage[type + '_id'] = data[0]['id'];
		};
	}
	data.forEach(function(item) {
		var option = $('<option>');
		option.attr('data-id', item['id']);
		if (item['id'] == session_id) { option.attr('selected', true) };
		if (type == 'technology') {
			// Technology
			option.val(item['pretty_name']);
			option.attr('data-tag', item['pretty_tag']);
			option.attr('data-icon', item['abstract_tech__icon']);
			option.html(item['pretty_name']);
		} else {
			// Scenario
			option.val(item['name']);
			option.html(item['name']);
		};
		$(".nav-dropdown").append(option);
	});
	function formatState (state) {
	  if (!state.id) { return state.text };
	  if (type == 'technology') {
	  	// Technology
	  	return $('<div class="row"><div class="col-5 text-overflow_ellipsis" style="text-align:right;"><b>' + state.text + '</b></div><div class="col-2 centered">' + state.element.dataset.icon + '</div><div class="col-5 text-overflow_ellipsis">' + state.element.dataset.tag + '</div></div>');
	  } else {
	  	// Scenario
	  	return $('<div class="row"><div class="col-12 centered"><i class="fas fa-code-branch"></i>&nbsp;&nbsp;&nbsp;&nbsp;<b>' + state.text + '</b></div></div>');
	  };
	};
	$('.nav-dropdown').unbind();
	$(".nav-dropdown").select2({
	  templateResult: formatState,
	  templateSelection: formatState
	});
	$('.nav-dropdown').on('select2:open', function (e) {
    	$('#overlay-back').fadeIn(500);
	});
	$('.nav-dropdown').on('select2:close', function () {
    	$('#overlay-back').fadeOut(500);
	});
}
