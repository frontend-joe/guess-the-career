// Lowercase set of allowed clubs for who-played-more.
// Only pairs where both players' shared club appears here will be used.
const TOP_CLUBS_LIST = [
  // England – Premier League / Championship historic
  'arsenal', 'aston villa', 'birmingham city', 'blackburn rovers', 'blackpool',
  'bolton wanderers', 'bradford city', 'brentford', 'brighton & hove albion',
  'brighton and hove albion', 'burnley', 'chelsea', 'coventry city', 'crystal palace',
  'derby county', 'everton', 'fulham', 'huddersfield town', 'hull city', 'ipswich town',
  'leeds united', 'leicester city', 'liverpool', 'luton town', 'manchester city',
  'manchester united', 'middlesbrough', 'millwall', 'newcastle united', 'norwich city',
  'nottingham forest', 'portsmouth', 'queens park rangers', 'reading', 'sheffield united',
  'sheffield wednesday', 'southampton', 'stoke city', 'sunderland', 'swansea city',
  'tottenham hotspur', 'watford', 'west bromwich albion', 'west ham united',
  'wigan athletic', 'wolverhampton wanderers',

  // Scotland
  'celtic', 'rangers', 'hearts', 'hibernian', 'aberdeen', 'motherwell',

  // Spain
  'athletic club', 'athletic bilbao', 'atlético de madrid', 'atletico de madrid',
  'atlético madrid', 'atletico madrid', 'barcelona', 'fc barcelona', 'celta vigo',
  'rc celta', 'rc celta de vigo', 'deportivo de la coruña', 'deportivo la coruña',
  'deportivo', 'espanyol', 'rcd espanyol', 'getafe cf', 'getafe', 'mallorca',
  'rcd mallorca', 'osasuna', 'ca osasuna', 'racing de santander', 'rayo vallecano',
  'real betis', 'real madrid', 'real sociedad', 'real valladolid', 'real zaragoza',
  'sevilla', 'sevilla fc', 'valencia', 'valencia cf', 'villarreal', 'villarreal cf',
  'real oviedo', 'sporting de gijón', 'levante ud',

  // Italy
  'ac milan', 'milan', 'atalanta', 'bologna', 'bologna fc', 'cagliari', 'empoli',
  'fiorentina', 'genoa', 'inter milan', 'internazionale', 'fc internazionale milano',
  'juventus', 'lazio', 'ss lazio', 'napoli', 'ssc napoli', 'palermo', 'us palermo',
  'parma', 'parma calcio', 'as roma', 'roma', 'sampdoria', 'uc sampdoria', 'sassuolo',
  'us sassuolo', 'torino', 'torino fc', 'udinese', 'hellas verona', 'verona', 'spezia',
  'venezia', 'lecce', 'us lecce', 'frosinone',

  // Germany
  'bayer leverkusen', 'bayer 04 leverkusen', 'bayern munich', 'fc bayern munich',
  'borussia dortmund', 'borussia mönchengladbach', 'borussia monchengladbach',
  'eintracht frankfurt', 'hamburger sv', 'hamburg sv', 'hanover 96', 'hannover 96',
  'hertha bsc', 'hertha berlin', 'rb leipzig', 'rasenballsport leipzig',
  'schalke 04', 'fc schalke 04', 'sc freiburg', 'tsg hoffenheim', 'tsg 1899 hoffenheim',
  'hoffenheim', 'vfb stuttgart', 'vfl wolfsburg', 'werder bremen', '1. fc köln',
  'fc köln', '1. fc kaiserslautern', 'kaiserslautern', 'vfl bochum', 'mainz 05',
  '1. fsv mainz 05', 'augsburg', 'fc augsburg', 'darmstadt 98',

  // France
  'bordeaux', 'girondins de bordeaux', 'rc lens', 'lens', 'lille', 'losc lille',
  'lyon', 'olympique lyonnais', 'marseille', 'olympique de marseille',
  'monaco', 'montpellier', 'montpellier hsc', 'nantes', 'fc nantes', 'nice', 'ogc nice',
  'paris saint-germain', 'paris saint germain', 'psg', 'rennes', 'stade rennais',
  'saint-étienne', 'saint-etienne', 'as saint-étienne', 'strasbourg', 'rc strasbourg',
  'toulouse', 'toulouse fc', 'nancy', 'as nancy',

  // Portugal
  'benfica', 'sl benfica', 'boavista', 'porto', 'fc porto', 'sporting cp',
  'sporting clube de portugal', 'sporting de lisboa', 'braga', 'sc braga', 'vitória de setúbal',

  // Netherlands
  'ajax', 'afc ajax', 'az', 'az alkmaar', 'feyenoord', 'psv',
  'fc utrecht', 'utrecht', 'twente', 'fc twente',

  // Belgium
  'anderlecht', 'rsc anderlecht', 'club brugge', 'standard liège', 'standard liege',

  // Turkey
  'beşiktaş', 'besiktas', 'fenerbahçe', 'fenerbahce', 'galatasaray', 'trabzonspor',

  // Russia / Eastern Europe
  'cska moscow', 'pfc cska moscow', 'lokomotiv moscow', 'spartak moscow',
  'fc spartak moscow', 'zenit', 'zenit saint petersburg', 'fc zenit saint petersburg',
  'dynamo kyiv', 'fc dynamo kyiv', 'shakhtar donetsk', 'fc shakhtar donetsk',
  'red star belgrade', 'fk red star belgrade', 'dinamo zagreb', 'gnk dinamo zagreb',
  'sparta prague', 'ac sparta prague', 'slavia prague', 'sk slavia prague',
  'steaua bucharest', 'fcsb', 'rapid vienna', 'sk rapid wien',

  // Greece
  'olympiacos', 'olympiakos', 'panathinaikos', 'aek athens',

  // Switzerland / Scandinavia
  'fc basel', 'rosenborg', 'rosenborg bk', 'ifk göteborg', 'malmö ff',
  'brøndby if', 'brondby if', 'copenhagen', 'fc copenhagen',

  // Brazil
  'corinthians', 'sport club corinthians paulista', 'cruzeiro', 'flamengo',
  'cr flamengo', 'fluminense', 'grêmio', 'gremio', 'internacional', 'sport club internacional',
  'palmeiras', 'santos', 'santos fc', 'são paulo', 'sao paulo', 'vasco da gama',
  'cr vasco da gama', 'atletico mineiro', 'atlético mineiro', 'botafogo',

  // Argentina
  'boca juniors', 'club atlético boca juniors', 'independiente',
  "newell's old boys", 'racing club', 'river plate', 'club atlético river plate',
  'san lorenzo', 'estudiantes', 'vélez sársfield', 'velez sarsfield',

  // Mexico / USA
  'chivas', 'cd guadalajara', 'club america', 'club américa', 'cruz azul',
  'la galaxy', 'los angeles galaxy', 'new york red bulls', 'toronto fc',

  // Other notable
  'al-hilal', 'al hilal', 'al-nassr', 'al nassr', 'al-ahly', 'al ahly',
  'urawa red diamonds', 'kashima antlers',
]

export const TOP_CLUBS = new Set(TOP_CLUBS_LIST)
