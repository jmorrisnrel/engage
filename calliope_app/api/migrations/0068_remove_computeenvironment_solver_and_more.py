# Generated by Django 4.2.15 on 2024-09-17 03:26

import api.models.engage
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0067_auto_20240613_1706'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='computeenvironment',
            name='solver',
        ),
        migrations.AddField(
            model_name='computeenvironment',
            name='solvers',
            field=models.JSONField(default=api.models.engage.default_solvers),
        ),
    ]