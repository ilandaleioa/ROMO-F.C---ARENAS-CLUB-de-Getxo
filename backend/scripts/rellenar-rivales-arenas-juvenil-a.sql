-- Ejecutar en el SQL Editor de Supabase.
-- Rellena los equipos rivales de "Liga ARENAS Juvenil A" con los datos
-- extraídos de la clasificación real de la federación (Liga Vasca Juvenil).

update public.competiciones
set rivales = '["AMOREBIETA \"A\"", "ANAITASUNA, C.D.", "AÑORGA K.K.E.", "ANTIGUOKO KIROL ELKARTEA \"C\"", "ARIZNABARRA", "ARRUPE-CHAMINADE, C.D.D.F.", "BEASAIN, S.D.", "BETOÑO, CD \"B\"", "DANOK BAT \"C\"", "DEUSTO", "INDARTSU, C.", "LAGUN ONAK C.D.", "OIARTZUN K.E.", "REAL UNION CLUB SAD", "SANTUTXU F.C. \"B\"", "URKI C.D.", "ZUMAIAKO F.T."]'::jsonb
where club = 'ARENAS'
  and url = 'https://www.euskadifutbol.eus/pnfg/NPcd/NFG_VisClasificacion?cod_primaria=1000120&codjornada=1&codcompeticion=24057862&codgrupo=24057863&codjornada=1&cod_agrupacion=1';

-- Comprueba que ha actualizado 1 fila. Si devuelve 0, la URL guardada en esa
-- competición no coincide exactamente con la de arriba: edítala a mano desde
-- "Competiciones" en su lugar.
