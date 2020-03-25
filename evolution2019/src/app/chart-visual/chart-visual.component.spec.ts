import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartVisualComponent } from './chart-visual.component';

describe('ChartVisualComponent', () => {
  let component: ChartVisualComponent;
  let fixture: ComponentFixture<ChartVisualComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ChartVisualComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartVisualComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
