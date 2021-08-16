function pull_technologies() {

	// Master Buttons
	$('.master-btn').hide();
	$('#master-new').show();
	$('#master-settings, #master-save, #master-new, #master-cancel').unbind();
	$('#master-save').on('click', function() {
		if (validate_params()) {
			var form_data_1 = $("#form_data_1 :input").serializeJSON();
			var form_data_2 = filter_param_inputs($("#form_data_2 :input")).serializeJSON();
			var form_data = Object.assign({}, form_data_1, form_data_2);
			$.ajax({
				url: '/' + LANGUAGE_CODE + '/api/update_tech_params/',
				type: 'POST',
				data: {
					'model_uuid': $('#header').data('model_uuid'),
					'technology_id': $("#technology option:selected").data('id'),
					'form_data': JSON.stringify(form_data),
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
	$('#master-new').on('click', function() {
		var model_uuid = $('#header').data('model_uuid');
		window.location = '/' + model_uuid + '/add_technologies/';
	});
	$('#master-cancel').on('click', function() {
		window.onbeforeunload = null;
		var model_uuid = $('#header').data('model_uuid');
		window.location = '/' + model_uuid + '/technologies/';
	});

	// Technology Selector
	$('.nav-dropdown').unbind('change');
	$('.nav-dropdown').on('change', function() {
		localStorage['technology_id'] = $(".nav-dropdown option:selected").data('id');
		get_technology_configuration();
	});

	// Build UI
	if ($(".nav-dropdown option").length == 0) { $('#technology_essentials').html('<div class="col-12 text-center"><br/><br/><h4>Create a technology by clicking the "+ New" button above!</h4></div>') };
	$('#technology_dashboard').show();
	$('.viz-spinner').show();
	get_technology_list();

};

function get_technology_list() {
	var model_uuid = $('#header').data('model_uuid');
	$.ajax({
		url: '/' + LANGUAGE_CODE + '/component/technologies/',
		type: 'GET',
		data: {
			'model_uuid': model_uuid,
			'csrfmiddlewaretoken': getCookie('csrftoken'),
		},
		dataType: 'json',
		success: function (data) {
			build_selector('technology', data['technologies']);
			get_technology_configuration();
		}
	});
}

function get_technology_configuration() {
	var model_uuid = $('#header').data('model_uuid'),
		technology_id = $(".nav-dropdown option:selected").data('id');
	console.log(model_uuid, technology_id);
	if (technology_id != undefined) {
		retrieve_map(false, undefined, technology_id, undefined);
		$.ajax({
			url: '/' + LANGUAGE_CODE + '/component/all_tech_params/',
			data: {
			  'model_uuid': model_uuid,
			  'technology_id': technology_id,
			},
			dataType: 'json',
			success: function (data) {
				$('#technology_essentials').html(data['html_essentials']);
				$('#technology_configuration').html(data['html_parameters']);
				$('#technology_configuration').data('favorites', data['favorites']);
				$('#technology_essentials').data('technology_id', data['technology_id']);
				activate_tech_delete();
				activate_table();
				activate_favorites();
				collapse_parameter_library();
				check_unsaved();
				activate_essentials();
			}
		});
	} else {
		$('#technology_essentials').html("");
		$('#technology_configuration').html("");
	};
};

function activate_tech_delete() {
	$('#technology-delete').on('click', function() {
		var confirmation = confirm('This will remove all parameter settings for this technology. Are you sure you want to delete?');
		if (confirmation) {
			$.ajax({
				url: '/' + LANGUAGE_CODE + '/api/delete_technology/',
				type: 'POST',
				data: {
					'model_uuid': $('#header').data('model_uuid'),
					'technology_id': $("#technology option:selected").data('id'),
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
};

function toggle_favorite($this, update_favorite) {
	var model_uuid = $('#header').data('model_uuid'),
		row = $this.parents('tr'),
		param_id = row.data('param_id');
	if ($this.hasClass('favorite')) {
		$this.removeClass('favorite');
		var add_favorite = false;
	} else {
		$this.addClass('favorite');
		var rows = $('tr[data-param_id='+param_id+']'),
			header = row.prevAll('.tbl-header').last();
		rows.insertBefore( header );
		var add_favorite = true;
	};
	if (update_favorite) {
		$.ajax({
			url: '/' + LANGUAGE_CODE + '/api/update_favorite/',
			data: {
				'model_uuid': model_uuid,
				'add_favorite': +add_favorite,
				'param_id': +param_id,
			},
			dataType: 'json'
		});
	};
}

function activate_favorites() {
	$($("tr").get().reverse()).each(function() {
		$this = $(this);
		var param_id = $(this).data('param_id'),
			favorites = $('#technology_configuration').data('favorites');
		if (favorites.includes(param_id)) {
			toggle_favorite($this.find('.fa-star'), false)
		};
	})
}

function activate_essentials() {
	$('#tech_name, #tech_tag, #tech_description, #tech_color').on('change keyup paste', function() {
		$(this).addClass('table-warning');
		$(this).siblings('.sp-replacer').addClass('btn-warning');
		check_unsaved();
	});
	activate_carrier_dropdowns();
	$("#tech_color").spectrum({showInput: true, allowEmpty:true, showInitial:true, preferredFormat: "hex"});
	$('.carrier-value-add').on('click', function() {
		var container = $(this).parent().parent().find('.new_carrier_form').last();
		new_container = container.clone().removeClass('hide');
		new_container.find('input').addClass('table-warning');
		new_container.insertBefore(container);
		activate_carrier_dropdowns();
		check_unsaved();
	});
	$('#tech_description').on('input click', function() {
		this.style.height = this.scrollHeight + 10 + "px";
	});
}

function activate_carrier_dropdowns() {
	$('.tech_carrier, .tech_carrier_ratio').unbind('change');
	$('.tech_carrier, .tech_carrier_ratio').on('change', function() {
		$(this).addClass('table-warning');
		$(this).siblings('.sp-replacer').addClass('btn-warning');
		check_unsaved();
		if ($(this).val() == '-- New Carrier --') {
			var carrier = prompt('New Carrier Name:'),
				o = new Option(carrier, carrier);
			$(o).html(carrier);
			$(this).append(o);
			$(this).val(carrier);
		};
	});
}

function activate_paste(class_name) {
	$(class_name).bind('paste', null, function(e) {
		var values = e.originalEvent.clipboardData.getData('Text').split(/\s+/),
			$txt = $(this),
			row = $txt.parents('tr'),
			param_id = row.data('param_id'),
			inputs = $('tr[data-param_id='+param_id+'] ' + class_name),
			index = inputs.index($txt);
		setTimeout(function () {
			for (var i = 0; i < values.length; i++) {
				var next = inputs.eq(index + i)
				if (next.length == 0) {
					var new_row = add_row($txt);
					next = new_row.find(class_name);
				} else {
					var next_row = next.parents('tr')
					next_row.addClass('table-warning');
					next_row.find('.parameter-reset').removeClass('hide')
					next_row.find('.parameter-delete, .parameter-value-delete').addClass('hide')
				};
				next.val(values[i]);
				next.trigger('change');
				next.focus();
			};
		}, 0);
	});
}

function activate_return(class_name) {
	$(class_name).keydown(function (e) {
		if ((e.which === 13) && ($('.autocomplete-active').length == 0)) {
			if (e.shiftKey) {
				var shift = -1;
			} else {
				var shift = +1;
			};
			var index = $(class_name).index(this) + shift;
			$(class_name).eq(index).focus();
		}
	});
}

function add_row($this) {
	var row = $this.parents('tr'),
		param_id = row.data('param_id');
	row.addClass('param_header');
	$('.param_row_'+param_id).removeClass('param_row_min');
	head_value_cell = row.find('.head_value');
	head_value_cell.removeClass('head_value').addClass('param_row_toggle');
	head_value_cell.find('.static_inputs').remove();
	row.find('.param_row_toggle').find('.hide_rows').removeClass('hide');
	row.find('.param_row_toggle').find('.view_rows').addClass('hide');
	var add_row = $('.add_param_row_'+param_id).last().clone();
	add_row.find('.parameter-value-new').addClass('dynamic_value_input');
	add_row.find('.parameter-year-new').addClass('dynamic_year_input');
	add_row.removeClass('add_param_row_min').addClass('table-warning');
	add_row.insertBefore($('.add_param_row_'+param_id).last());
	add_row.find('.parameter-target-value').html('');
	add_row.find('.parameter-target-value').attr('data-value', '');
	activate_table();
	check_unsaved();
	return add_row;
}

function check_unsaved() {
	// Set warning on parameter headers if sub rows have modifications
	$('.param_header').removeClass('table-warning')
	$('.tbl-header').removeClass('table-warning')
	$('.table-warning, .table-danger').each(function() {
		var param_id = $(this).data('param_id');
		$('.param_header[data-param_id='+param_id+']').addClass('table-warning');
		$(this).prevAll('.tbl-header').first().addClass('table-warning');
	});
	// If modifications exist, activate the SAVE button
	$('.master-btn').addClass('hide');
	if ($('.table-warning, .table-danger').length == 0) {
		$('#master-new').removeClass('hide');
		window.onbeforeunload = null;
	} else {
		$('#master-save').removeClass('hide');
		$('#master-cancel').removeClass('hide');
		window.onbeforeunload = function() {
			return true;
		};
	};
}

function filter_param_inputs(query) {

	return query.filter(function(index, element) {
		var val = $(element).val(),
			tval = $(element).attr('data-target_value');
		if ((tval != undefined) & (tval != val)) {
			$(element).val(tval + '||' + val);

		};
		var has_value = $(element).val() != '',
			is_modified = $(element).parents('tr').hasClass('table-warning'),
			is_delete = $(element).parents('tr').hasClass('table-danger');
		if (is_modified && has_value) {
			$(element).css('background-color', '#28a745');
		};
		return ((is_modified && has_value) || is_delete);
	})

}

function validate_params() {
	var validated = true;
	$('.param_row').each(function() {
		var year_input = $(this).find('.parameter-year-new.dynamic_year_input'),
			value_input = $(this).find('.parameter-value-new.dynamic_value_input');
		if (year_input.length > 0) {
			if (!year_input.val()) {
				var param_id = $(this).data('param_id');
				param_row_toggle(param_id, true);
				year_input.focus();
				setTimeout(function(){alert('Oops! One or more year fields were left blank')}, 10);
				validated = false;
				return false;
			} else {
				if ((!(year_input.val() <= 9999)) | (!(year_input.val() >= 0))) {
					var param_id = $(this).data('param_id');
					param_row_toggle(param_id, true);
					year_input.focus();
					setTimeout(function(){alert('Oops! One or more year fields are invalid')}, 10);
					validated = false;
					return false;
				}
			};
			if (!value_input.val()) {
				var param_id = $(this).data('param_id');
				param_row_toggle(param_id, true);
				value_input.focus();
				setTimeout(function(){alert('Oops! One or more value fields were left blank')}, 10);
				validated = false;
				return false;
			};
		};
	});
	return validated;
}
