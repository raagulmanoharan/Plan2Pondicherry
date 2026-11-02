import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from argparse import Namespace
from PIL import Image
import pilot

class PilotTests(unittest.TestCase):
    def test_metric_and_corridor(self):
        config={'start':[11.9288,79.834],'end':[11.9298,79.834]}
        order,distance=pilot.along((11.9293,79.834),config)
        self.assertAlmostEqual(order,.5);self.assertAlmostEqual(distance,0)
        self.assertGreater(pilot.along((11.9293,79.835),config)[1],100)

    def test_stitch_preserves_tile_layout(self):
        def fetch(url,binary):
            x=int(url.split('&x=')[1].split('&')[0]);tile=Image.new('RGB',(512,512),(255,0,0)if x==0 else(0,0,255));b=io.BytesIO();tile.save(b,format='PNG');return b.getvalue()
        image=pilot.stitch(fetch,'test',1024,512)
        self.assertEqual(image.size,(1024,512));self.assertEqual(image.getpixel((0,0)),(255,0,0));self.assertEqual(image.getpixel((1023,0)),(0,0,255))

    def test_download_error_does_not_generate_fake_panorama(self):
        def fail(*args):raise RuntimeError('HTTP 403')
        with self.assertRaisesRegex(RuntimeError,'403'):pilot.stitch(fail,'test',1024,512)

    def test_projection_requires_correct_aspect(self):
        with self.assertRaises(ValueError):pilot.stitch(None,'test',1024,1024)

    def test_selection_keeps_one_period_and_distinct_positions(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp);rows=[{'panoid':str(i),'lat':11.9288+i*.0001,'lon':79.834,'year':2024,'month':3,'order':i/10}for i in range(5)]
            rows.append({**rows[0],'panoid':'historical','year':2018})
            pilot.save(out/'discovery.json',{'panoramas':rows})
            pilot.select(Namespace(period='2024-03'),{'max_panoramas':4},out)
            result=json.loads((out/'selection.json').read_text());self.assertEqual(len(result['panoramas']),4);self.assertTrue(all(p['year']==2024 for p in result['panoramas']))

    def test_official_panorama_renderer_uses_shared_origin_rigs(self):
        import numpy as np
        import pycolmap.panorama as panorama
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in ['panos','views','masks']:(root/name).mkdir()
            Image.fromarray(np.random.default_rng(1).integers(0,255,(512,1024,3),dtype=np.uint8)).save(root/'panos'/'0000.jpg')
            result=panorama.render_perspective_images(['0000.jpg'],root/'panos',root/'views',root/'masks',panorama.PANO_RENDER_OPTIONS[panorama.PanoRenderType.PERSPECTIVE_OVERLAPPING],False)
            self.assertEqual(len(list((root/'views').rglob('*.jpg'))),12)
            for camera in result.rig_config.cameras:
                if not camera.ref_sensor:self.assertTrue(np.allclose(camera.cam_from_rig.translation,0))

    def test_http_denial_stops_without_retry(self):
        import requests
        with patch('requests.get',side_effect=requests.HTTPError('403'))as get:
            with self.assertRaises(requests.HTTPError):pilot.get('https://example.com')
            self.assertEqual(get.call_count,1)

if __name__=='__main__':unittest.main()
