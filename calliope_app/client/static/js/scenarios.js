var bulk_confirmation = false;

function pull_scenarios() {

	// Master Buttons
	$('.master-btn').hide();
	$('#master-new').show();
	$('#master-settings, #master-save, #master-new, #master-cancel').unbind();
	$('#master-settings').on('click', function() {
		$('.master-btn').hide();
		$('#master-save').show();
		$('#master-cancel').show();
		$('#form_scenario_settings').show();
		$('#scenario_configuration').hide();
	});
	$('#master-save').on('click', function() {
		$('.master-btn').hide();
		$('#master-settings').show();
		$('#form_scenario_settings').hide();
		$('#scenario_configuration').show();
		save_scenario_settings();
	});
	$('#master-new').on('click', function() {
		var model_uuid = $('#header').data('model_uuid');
		window.location = '/' + model_uuid + '/add_scenarios/';
	});
	$('#master-cancel').on('click', function() {
		var model_uuid = $('#header').data('model_uuid');
		window.location = '/' + model_uuid + '/scenarios/';
	});

	// Scenario Selector
	$('.nav-dropdown').unbind('change');
	$('.nav-dropdown').on('change', function() {
		localStorage['scenario_id'] = $(".nav-dropdown option:selected").data('id');
		get_scenario_configuration();
	});

	// Build UI
	$('#scenario_configuration').show();
	$('.viz-spinner').show();
	get_scenario_list();

};

function save_scenario_settings() {

	var model_uuid = $('#header').data('model_uuid'),
		scenario_id = $(".nav-dropdown option:selected").data('id'),
		form_data = $("#form_scenario_settings :input").serializeJSON();

	$.ajax({
		url: '/' + LANGUAGE_CODE + '/api/update_scenario_params/',
		type: 'POST',
		data: {
			'model_uuid': model_uuid,
			'scenario_id': scenario_id,
			'form_data': JSON.stringify(form_data),
			'csrfmiddlewaretoken': getCookie('csrftoken'),
		},
		dataType: 'json',
		success: function (data) {
			window.onbeforeunload = null;
			location.reload();
		}
	});

}

function get_scenario_configuration() {
	var model_uuid = $('#header').data('model_uuid'),
		scenario_id = $(".nav-dropdown option:selected").data('id');
	
	if (scenario_id != undefined) {
		map_mode = 'scenarios';
		retrieve_map(false, scenario_id, undefined);
		$.ajax({
			url: '/' + LANGUAGE_CODE + '/component/scenario/',
			data: {
			  'model_uuid': model_uuid,
			  'scenario_id': scenario_id,
			},
			dataType: 'json',
			success: function (data) {
				active_lt_ids = data['active_lt_ids'];
				loc_techs = data['loc_techs'];
				$('#scenario_settings').html(data['scenario_settings']);
				$('#scenario_configuration').html(data['scenario_configuration']);
				$('#scenario_configuration').data('scenario_id', data['scenario_id']);
				activate_scenario_settings();
				activate_scenario_configurations();
				activate_table();
			}
		});
	} else {
		$('.viz-spinner').hide();
		$('#map').remove();
		$('#scenario_configuration').html('<div class="col-12 text-center"><br/><br/><h4>Select or create a scenario above!</h4></div>');
	};
};

function activate_scenario_configurations() {
	$('.add_loc_tech').on('change', function(e) {
		var loc_tech_id = $(this).parents('tr').data('loc_tech_id');
		if (e.target.checked) {
			toggle_scenario_loc_tech([loc_tech_id], true)
			$(this).parents('tr').addClass('table-info')
		} else {
			toggle_scenario_loc_tech([loc_tech_id], false)
			$(this).parents('tr').removeClass('table-info')
		}
	})
	$('#add_loc_techs').on('change', function(e) {
		if (bulk_confirmation == false) {
			bulk_confirmation = confirm('This will toggle every node shown below.\nAre you sure you want to enable bulk editing?');
		};
		if (bulk_confirmation == true) {
			var loc_tech_ids = [];
			if (e.target.checked) {
				var visible_loc_techs = $(".node").not(".hide").find(".add_loc_tech:not(:checked)");
				visible_loc_techs.each( function() {
					var row = $(this).parents('tr');
					loc_tech_ids.push(row.data('loc_tech_id'));
					$(this).prop( "checked", true );
					row.addClass('table-info');
				});
				toggle_scenario_loc_tech(loc_tech_ids, true);
			} else {
				var visible_loc_techs = $(".node").not(".hide").find(".add_loc_tech:checked");
				visible_loc_techs.each( function() {
					var row = $(this).parents('tr');
					loc_tech_ids.push(row.data('loc_tech_id'));
					$(this).prop( "checked", false );
					row.removeClass('table-info');
				});
				toggle_scenario_loc_tech(loc_tech_ids, false);
			}
		} else {
			$(this).prop("checked", !$(this).is(":checked"));
			return false;
		}
	})
	$('#tech-filter, #tag-filter, #location-filter').on('change', function(e) {
		filter_nodes();
	})
	if ($('#master-cancel').hasClass('hide')) {
		$('#master-settings').show();
	}
	$('#scenario-delete').on('click', function() {
		var model_uuid = $('#header').data('model_uuid'),
			scenario_id = $("#scenario option:selected").data('id');
		var confirmation = confirm('This will remove all configurations and runs for this scenario.\nAre you sure you want to delete?');
		if (confirmation) {
			$.ajax({
				url: '/' + LANGUAGE_CODE + '/api/delete_scenario/',
				type: 'POST',
				data: {
					'model_uuid': model_uuid,
					'scenario_id': scenario_id,
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
}

function activate_scenario_settings() {
	$('.run-parameter-value, .run-parameter-year').on('input change paste', function() {
		$(this).parents('tr').addClass('table-warning')
	});
	$('.run-parameter-value-add').on('click', function() {
		var row = $(this).parents('tr'),
			param_id = row.data('param_id'),
			add_row = row.nextAll('.param_header_add[data-param_id='+param_id+']').first().clone();
		add_row.insertAfter($('tr[data-param_id='+param_id+']').last());
		add_row.show()
	});
	$('.run-parameter-value-remove').on('click', function() {
		var row = $(this).parents('tr')
		row.addClass('table-danger')
		row.find('.check_delete').prop("checked", true)
	});
}

function filter_nodes() {
	$('.node').hide();
	var tech = $('#tech-filter').val(),
		tag = $('#tag-filter').val(),
		location = $('#location-filter').val(),
		filter_selection = $('.node');
	if (tech != '') { filter_selection = filter_selection.filter('*[data-tech="' + tech + '"]'); filter = true; }
	if (tag != '') { filter_selection = filter_selection.filter('*[data-tag="' + tag + '"]'); filter = true; }
	if (location != '') { filter_selection = filter_selection.filter('*[data-locations*="' + "'" + location + "'" + '"]'); filter = true; }
	filter_selection.show();
}

function toggle_scenario_loc_tech(loc_tech_ids, add) {
	if (loc_tech_ids.length > 0) {
		$('.viz-spinner').show();
		var model_uuid = $('#header').data('model_uuid'),
			scenario_id = $(".nav-dropdown option:selected").data('id');
		$.ajax({
			url: '/' + LANGUAGE_CODE + '/api/toggle_scenario_loc_tech/',
			type: 'POST',
			data: {
			  'model_uuid': model_uuid,
			  'scenario_id': scenario_id,
			  'loc_tech_ids': loc_tech_ids.join(','),
			  'add': +add,
			  'csrfmiddlewaretoken': getCookie('csrftoken'),
			},
			dataType: 'json',
			success: function (data) {
				active_lt_ids = data['active_lt_ids'];
				map_mode = 'scenarios';
				retrieve_map(false, scenario_id, undefined);
			}
		});
	};
}

function get_scenario_list() {
	var model_uuid = $('#header').data('model_uuid');
	$.ajax({
		url: '/' + LANGUAGE_CODE + '/component/scenarios/',
		type: 'GET',
		data: {
			'model_uuid': model_uuid,
			'csrfmiddlewaretoken': getCookie('csrftoken'),
		},
		dataType: 'json',
		success: function (data) {
			build_selector('scenario', data['scenarios']);
			get_scenario_configuration();
		}
	});
}
