# Generated by Django 3.2.25 on 2024-09-18 16:46

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0069_auto_20240802_2220'),
    ]

    operations = [
        migrations.AlterField(
            model_name='run_parameter',
            name='default_value',
            field=models.CharField(max_length=1000),
        ),
    ]