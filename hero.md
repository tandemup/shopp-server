## creacion de base de datos

joshnash@MacBook-Aria shopp-server % heroku addons:create heroku-postgresql:essential-0 -a shopp-server

Creating heroku-postgresql:essential-0 on ⬢ shopp-server... ~$0.007/hour (max $5/month)
Database should be available soon

postgresql-concentric-39738 is being created in the background. The app will restart when complete...

Run heroku addons:info postgresql-concentric-39738 to check creation progress.
Run heroku addons:docs heroku-postgresql to view documentation.

== ⬢ shopp-server Config Vars

DATABASE_URL: postgres://u63okaju130hj:pdccbac3c42b97b35b9b66e12915ebc1a4be505a48e045036cde47c01054a13f1@c4mf833jfd7vec.cluster-czz5s0kz4scl.eu-west-1.rds.amazonaws.com:5432/dfgsdg5v6vqapb

joshnash@MacBook-Aria shopp-server % heroku pg:info -a shopp-server
=== DATABASE_URL

Plan: essential-0
Status: Available
Connections: unknown/20
PG Version: 17.9
Created: 2026-06-21 19:18
Data Size: unknown usage / 1 GB (In compliance)
Tables: 0/4000 (In compliance)
Fork/Follow: Unsupported
Rollback: Unsupported
Continuous Protection: On
Add-on: postgresql-concentric-39738

## Comprueba si tu app tiene PostgreSQL

heroku addons -a shopp-server

## O tambien asi

heroku pg:info -a shopp-server

## Si no aparece una base de datos, tienes que crearla:

heroku addons:create heroku-postgresql:essential-0 -a shopp-server

## Despues comprueba

heroku config:get DATABASE_URL -a shopp-server
