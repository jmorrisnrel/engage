import json
from django.conf import settings
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect
from django.urls import reverse
from api.models.engage import Help_Guide, ComputeEnvironment
from api.models.configuration import Model, Scenario_Param
import re
from pytz import common_timezones
import logging
import requests
from api.models.engage import Help_Guide, ComputeEnvironment
from api.models.configuration import Model
import re
from pytz import common_timezones
from api.views.configuration import get_mapbox_token

logger = logging.getLogger(__name__)

def runs_view(request, model_uuid):
    """
    View the "Runs" page

    Parameters:
    model_uuid (uuid): required

    Returns: HttpResponse

    Example:
    http://0.0.0.0:8000/<model_uuid>/run
    """
    token_response = get_mapbox_token(request)
    if token_response.status_code == 200:
        response = json.loads(token_response.content.decode('utf-8'))
        token = response.get("token")
    else:
        token = ""

    model = Model.by_uuid(model_uuid)
    try:
        can_edit = model.handle_view_access(request.user)
    except Exception:
        return HttpResponseRedirect(reverse('home'))

    scenarios = model.scenarios

    session_scenario_id = request.session.get('scenario_id', None)
    session_scenario = scenarios.filter(id=session_scenario_id).first()

    context = {
        "timezones": common_timezones,
        "model": model,
        "scenarios": scenarios,
        "session_scenario": session_scenario,
        "can_edit": can_edit,
        "mapbox_token": token,
        "cambium_url": settings.CAMBIUM_URL + '?project=' + str(model.uuid),
        "help_content": Help_Guide.get_safe_html('runs'),
    }

    return render(request, "run.html", context)


@login_required
def add_runs_view(request, model_uuid, scenario_id):
    """
    View the "Add Run" page

    Parameters:
    model_uuid (uuid): required

    Returns: HttpResponse

    Example:
    http://0.0.0.0:8000/<model_uuid>/add_runs_view
    """

    model = Model.by_uuid(model_uuid)
    can_edit = model.handle_view_access(request.user)
    parameters = Scenario_Param.objects.filter(
        model_id=model.id, scenario_id=scenario_id,
        run_parameter__user_visibility=True, run_parameter__tab="runs")
    try:
        default_environment = ComputeEnvironment.objects.get(name__iexact="default")
    except ComputeEnvironment.DoesNotExist:
        default_environment = ComputeEnvironment.objects.create(
            name="default",
            full_name="default",
            is_default=True,
            type="Celery Worker",
            ncpu=4,
            memory=32
        )

    compute_environments = [default_environment]
    user_assigned_environments = request.user.compute_environments.all().exclude(name__iexact="default")
    for compute_environment in user_assigned_environments:
        compute_environments.append(compute_environment)

    context = {
        "compute_environments": compute_environments,
        "timezones": common_timezones,
        "model": model,
        "scenario": model.scenarios.get(id=scenario_id),
        "can_edit": can_edit,
        "help_content": Help_Guide.get_safe_html('add_run'),
        "parameters": parameters
    }

    return render(request, "add_run.html", context)


def map_viz_view(request, model_uuid, run_id):
    """ Example:
    http://0.0.0.0:8000/<model_uuid>/<run_id>/map_viz """
    token_response = get_mapbox_token(request)
    if token_response.status_code == 200:
        response = json.loads(token_response.content.decode('utf-8'))
        token = response.get("token")
    else:
        token = ""

    model = Model.by_uuid(model_uuid)
    try:
        can_edit = model.handle_view_access(request.user)
    except Exception:
        return HttpResponseRedirect(reverse('home'))

    run = model.runs.filter(id=run_id).first()

    subset_time = run.subset_time  # 2005-01-01 to 2005-01-07
    run_min_date, run_max_date = re.match(
        r"^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$", subset_time).groups()
    context = {
        "timezones": common_timezones,
        "model": model,
        "run": run,
        "scenario": run.scenario,
        "mapbox_token": token,
        "can_edit": can_edit,
        "run_min_date": run_min_date,
        "run_max_date": run_max_date
    }

    return render(request, "map_viz.html", context)
