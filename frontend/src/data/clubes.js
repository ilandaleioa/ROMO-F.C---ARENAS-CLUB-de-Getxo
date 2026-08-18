function parseClubesRaw(raw) {
  const clubesPorNombre = new Map();

  raw
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .forEach((linea) => {
      if (linea.startsWith('nombre_club')) return;

      const [nombreBruto = '', escudoBruto = ''] = linea.split('|');
      const nombre = nombreBruto.trim();
      if (!nombre) return;

      const escudo = escudoBruto.trim();
      const registro = {
        nombre,
        valor: nombre,
        escudo: escudo.startsWith('http') ? escudo : '',
      };

      const existente = clubesPorNombre.get(nombre);
      if (!existente || (!existente.escudo && registro.escudo)) {
        clubesPorNombre.set(nombre, registro);
      }
    });

  return Array.from(clubesPorNombre.values());
}

const CLUBES_RAW = String.raw`
nombre_club | FOTO ESCUDO
ABADIÑO K.E. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1093_grande.png
ABANTO C. | https://i.ibb.co/yf0VCYD/ABANTO.png
ABETXUKO ADC | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFAF/1.gif
ACERO C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1014_grande.png
ALIPENDI CD | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFAF/3.jpg
ALTZARRATE LAUDIO K.E. (FEM.) |
AMOREBIETA S.D. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106436_ESCUDO_SDA_COLOR__2_.png
AMURRIO CLUB | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFAF/4.jpg
ANTIGUOKO K.E (FEM.) | https://i.ibb.co/bLMcK3m/Logo-Escudo-Antiguoko.png
ANTIGUOKO K.E. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFGF/2030.jpg
APURTUARTE C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1036_grande.png
ARANGUREN C.AT. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1129_grande.png
ARBONA F.C. |
ARBUYO S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1063_grande.png
ARENAS C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1002_grande.png
ARIZ S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1122_grande.png
ARIZ S.D. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1122_grande.png
ARRATIA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1059_grande.png
ARRATIA C.D. (FEM.) | https://i.ibb.co/nsvKSkR/Arratia-Escudo.png
ARRONTEGI AFK F.K. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1156_grande.png
ARRONTEGI AFK F.K. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1156_grande.png
ARTIBAI C.D. (FEM) | https://i.ibb.co/HnDFNjM/ARTIBAI.png
ARTIBAI F.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1166_grande.png
ARTXANDAKO MERTXETARRAK K.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1415_grande.png
ASDEFOR | https://i.ibb.co/51DHcjD/ASDEFOR-removebg-preview.png
ASKARTZA-CLARET C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1197_grande.png
ASTI-LEKU C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1169_grande.png
ASTRABUDUAKO F.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1301_grande.png
ATHLETIC C. | https://i.ibb.co/XDrFxKt/athletic.png
ATXULAUR K.E. | https://i.ibb.co/6mjxhk1/atxulaur.png
AURRERA K.E. | https://i.ibb.co/nDBLZ9N/Aurrera-KEEscudo-1.png
AURRERA K.E. (FEM) | https://i.ibb.co/nDBLZ9N/Aurrera-KEEscudo-1.png
BAKIO K.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1288_grande.png
BALMASEDA F.C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1006_grande.png
BALMASEDA F.C. (FEM) | https://i.ibb.co/rb8qdrt/BALMASEDA.png
BARAKALDO C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1009_grande.png
BARRIKA F.E. | https://i.ibb.co/LzZ91g9/BARRIKA.gif
BASAURI-B.E.A. C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1043_grande.png
BASAURIKO KIMUAK |
BASCONIA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1004_grande.png
BASKAURI F.E.A.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1651_grande.png
BASURTO S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1024_grande.png
BEGOÑA S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1030_grande.png
BERANGO F.T. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106474_1712405155706.png
BERMEO F.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1049_grande.png
BERRIATUKO F.T. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106488_IMG_20231206_144303__1__removebg_preview.png
BERRIOTXOA NESKAK A.D. (FEM.) |
BERRIZ C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1090_grande.png
BETOLATZA C.D.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1501_grande.png
BIAK BAT K.K. (FEM) |
BIARRITZ J.A. |
BIARRITZ J.A. (FEM) |
BILBAO ARTIZARRAK F.K. (FEM) | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106491_Artizarrak_logo_noticias_350x300__2__removebg_preview.png
BIZKENESKAK F.T. |
BIZKERRE C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1203_grande.png
BIZKERRE C. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1203_grande.png
BUSTURIA UR-ZELAI F.K. | º
CIRBONERO, CLUB ATLÉTICO | https://i.ibb.co/8NwYffv/escudo-c-atletico-cirbonero-removebg-preview.png
CLUB DEPORTIVO SUBIZA |
COLEGIO VIZCAYA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1165_grande.png
CULTURAL DPVA. DURANGO S. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1020_grande.png
DANOK BAT C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1086_grande.png
DERIO C.D. |
DERIO C.D. (FEM.) | https://i.ibb.co/M8kStQk/derio.png
DEUSTO S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1005_grande.png
DINAMO SAN JUAN C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1095_grande.png
DOSA-SALESIANOS S.C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1273_grande.png
DUNBOA EGUZKI C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFGF/2103.jpg
DUNBOA EGUZKI C.D. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFGF/2103.jpg
DURANGOKO SAPUHERRIAK C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1225_grande.png
ELORRIETA C.D. | https://i.ibb.co/cFqFxdQ/ELORRIETA.png
ELORRIETA C.D. (FEM) | https://i.ibb.co/cFqFxdQ/ELORRIETA.png
ELORRIO C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1031_grande.png
ELORRIO C.D. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1031_grande.png
ENKARTERRI NESKAK F.K.E. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1531_grande.png
ERANDIO S. D. C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1007_grande.png
ERANDIOKO BETIKO NESKAK F.K.E. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1522_grande.png
ERMUA C.D. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106612_escudoErmua.png
ESCOLAPIOS A.D. |
ETORKIZUN F.T. | https://i.ibb.co/5L4tGgz/etorkizun.png
ETORKIZUNA AIALAKO F.T. | https://i.ibb.co/2FYZYZN/ETORKIZUNA.png
ETXEBARRI S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1056_grande.png
ETXEBARRI S.D. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1056_grande.png
EZKURDI K.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1356_grande.png
EZKURDI K.T. (FEM) | https://i.ibb.co/DMMcqmG/EZKURDI.webp
FALCESINO C.D. | https://i.ibb.co/FYTL8pT/FALCESINO.png
FRUIZ K.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1167_grande.png
GALDAKAO C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1021_grande.png
GALEA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1078_grande.png
GALLARTA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1050_grande.png
GAZTEAK C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1092_grande.png
GAZTELUETA C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1247_grande.png
GAZTELUZARRA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1393_grande.png
GERNIKA C. S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1019_grande.png
GERNIKA C. S.D. | --
GERNIKA SPORTING | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1158_grande.png
GERTASPORT K.K. | https://i.ibb.co/T0yJpfb/GERTASPORT.png
GETXO C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1038_grande.png
GORDEXOLA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1054_grande.png
GORLIZ S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1216_grande.png
GURUTZETA K.F.T. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106494_Escudo_removebg_preview.png
HIRIBURUKO AINARA F.C. |
HIRIBURUKO AINARA F.C. (FEM) |
IBAIONDO NERBIOI ERREKA F.K. | https://i.ibb.co/mSDPxsg/ibaiondo.png
IBAIONDO NERBIOI ERREKA F.K. (FEM.) | https://i.ibb.co/mSDPxsg/ibaiondo.png
IBARREKO C.D.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1417_grande.png
IBARSUSI C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1322_grande.png
IKAS TXIKI K.E.A.D. | https://i.ibb.co/G5WgcP9/IKASTXIKI.jpg
IKAS TXIKI K.E.A.D. (FEM) | https://i.ibb.co/G5WgcP9/IKASTXIKI.jpg
IKHOBA K.K. | https://i.ibb.co/ZMNzrdR/IKHOBA.png
IKHOBA K.K. (FEM) | https://i.ibb.co/ZMNzrdR/IKHOBA.png
INDARRA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1204_grande.png
INDARTSU C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1060_grande.png
INDARTSU C. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1060_grande.png
INDAUTXU S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1037_grande.png
INDAUTXU S.D. (FEM.) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1037_grande.png
ITUGARPE C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1485_grande.png
ITURGITXI F.C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1198_grande.png
ITURRIGORRI S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1023_grande.png
IURRETAKO K.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1146_grande.png
JESUITAS C.F. | https://i.ibb.co/R6fNTfg/jesuitak.png
KARABIGANE | https://i.ibb.co/wzrNQzX/karabigane-berango.png
KARRANTZA C.DE DEPORTES | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1072_grande.png
KASKAGORRI AMURRIOKO F.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFAF/19.bmp
LA ARBOLEDA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1055_grande.png
LA MERCED U.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1046_grande.png
LA SALLE C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1066_grande.png
LAKUA C.D. | https://i.ibb.co/H4DQws6/Escudo-CD-Lakua.png
LAKUA C.D. (FEM.) | https://i.ibb.co/H4DQws6/Escudo-CD-Lakua.png
LARRAMENDI C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1016_grande.png
LAUAXETA IK. A.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1385_grande.png
LAUDIO F. SAN ROKEZAR C.D. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000114836_Laudio.png
LAURO IK. C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1147_grande.png
LAURO IK. C.F. (FEM.) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1147_grande.png
LEIOA S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1034_grande.png
LEIOAKO EMAKUMEAK SARRIENA FKE | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1483_grande.png
LEKEITIO F.T. | https://i.ibb.co/rkXS3MN/lekeitio.png
LEMOA HARROBI F.K. | https://i.ibb.co/wsmvXvp/LEMOA.jpg
LOIU C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1041_grande.png
LOYOLA INDAUCHU CLUB | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1083_grande.png
LUMO K.E.A.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1611_grande.png
MENES C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1253_grande.png
MONTEFUERTE C.D. | https://i.ibb.co/r5y3NgH/montefuerte-removebg-preview.png
MORAZA S.D. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106489_IMG_20240416_WA0000_removebg_preview.png
MUNGIA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1071_grande.png
MUNGIA C.D. (FEM.) | https://i.ibb.co/Rh7qz81/mungia.png
NEGURI S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1141_grande.png
OBERENA C.D. | https://i.ibb.co/gWc6crg/OBERENA.png
OBERENA C.D. (FEM.) | https://i.ibb.co/gWc6crg/OBERENA.png
ORDUÑA C. D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1026_grande.png
ORDUÑA C. D. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1026_grande.png
ORTUELLA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1047_grande.png
ORTUELLAKO JENDEA (FEM.) | https://i.ibb.co/M5t4z3p/ORTUELLAKO-JENDEA.png
ORTUELLAKO JENDEA 1999 K.K. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1672_grande.png
OTXARKOAGA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1073_grande.png
OYONESA S.D. | https://i.ibb.co/dMyhJB5/sdoyonesa-ok-caa31810.png
OYONESA S.D. (FEM) | https://i.ibb.co/dMyhJB5/sdoyonesa-ok-caa31810.png
PADURA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1013_grande.png
PAMPLONA C.D. | https://i.ibb.co/gMzFQKC/CD-Pamplona-escudo-Zico-01.png
PAULDARRAK F.K.T. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106480_Logotipo_Pauldarrak_ok_removebg_preview.png
PAULDARRAK F.K.T. (FEM.) | https://i.ibb.co/JsffX9Z/PAULDARRAK.png
PEÑA ATHLETIC SANTURTZI C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1282_grande.png
PEÑA ATHLETIC SANTURTZI C.F. (FEM.) | https://i.ibb.co/h8D7VHB/pen-a-athletic.png
PEÑA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1018_grande.png
PEÑA GALDAMES ATHLETIC CLUB, A.D.A. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106483_ESCUDO_PE_A_GALDAMES_TRAZ_OK_001.png
PLENTZIA S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1119_grande.png
PLENTZIA S.D. (FEM.) | https://i.ibb.co/pnsCYgW/plentzia.png
PORTUGALETE C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1003_grande.png
PORTUGALETE C. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1003_grande.png
RETUERTO SPORT S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1061_grande.png
ROMO F.C. | https://i.ibb.co/mFZqQp2/arenas-romo-escudo-sin.png
SALESIANOS C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1062_grande.png
SAN ANTONIO C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1088_grande.png
SAN IGNACIO S.D. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0009916886_00100_0000106502_IMG_20180914_WA0004_removebg_preview.png
SAN MIGUEL U.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1058_grande.png
SAN PEDRO S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1025_grande.png
SANTURTZI C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1053_grande.png
SANTUTXU F.C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1011_grande.png
SESTAO RIVER C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1384_grande.png
SESTAO RIVER C. (FEM.) | https://i.ibb.co/98pVM54/Escudo-Sestao-River.png
SODUPE U.C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1045_grande.png
SOLOKOETXE C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1035_grande.png
SOMORROSTRO J.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1040_grande.png
SOMORROSTRO J.D. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1040_grande.png
SONDIKA C.D. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000106487_cdsondika.png
SOPUERTA SPORT C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1199_grande.png
SPORTING DE LUTXANA | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1012_grande.png
SPORTING DE LUTXANA (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1012_grande.png
TRAPAGARAN C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1133_grande.png
TRAPAGARAN C.F. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1133_grande.png
TUDELANO, C.D. | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000113440_Tudelano.png
TUDELANO, C.D. (FEM) | https://fvf.novanet.es/nfg/pimg/Clubes/00100_0000113440_Tudelano.png
TXANTREA UDC KKE | https://i.ibb.co/qsKx1Hb/TXANTREA.png
TXURDINAGA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1159_grande.png
UGAO C.D. | https://i.ibb.co/0tnJ7Fx/ugao.png
UGAO C.D. (FEM.) | https://i.ibb.co/0tnJ7Fx/ugao.png
UGERAGA S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1152_grande.png
UGERAGA S.D. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1152_grande.png
UMORE ONA S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1163_grande.png
UNION SPORT SAN VICENTE | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1027_grande.png
URDANETA C.D. | https://i.ibb.co/3cmSSbB/urdaneta.png
URDULIZ F.T. | https://i.ibb.co/zRQhMN0/Urduliz-Escudo.png
URITARRA C.D. (FEM) | https://i.ibb.co/27y63DR/uritarra.png
URITARRA K.T. | https://i.ibb.co/27y63DR/uritarra.png
URRETXINDORRA IK. A.D. | https://i.ibb.co/wKSDBFx/urretxindorra.png
VULCANO C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1648_grande.png
ZALDUA C.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1089_grande.png
ZALLA U.C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1032_grande.png
ZAMUDIO S.D. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1042_grande.png
ZAZPI LANDA K.T. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1311_grande.png
ZAZPI LANDA K.T. (FEM.) | https://i.ibb.co/41hwPjS/ESC-ZAZPI-LANDA-K-T.png
ZORROZA F.C. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1015_grande.png
ZUAZO C.F. | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1110_grande.png
ZUAZO C.F. (FEM) | https://fvf.novanet.es/nfg/pimg/MigracionPV/escudosFVF/1110_grande.png
`;

export const CLUBES_MAESTROS = parseClubesRaw(CLUBES_RAW);
