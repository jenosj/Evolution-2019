import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AllModuleCardComponent } from './all-module-card.component';

describe('AllModuleCardComponent', () => {
  let component: AllModuleCardComponent;
  let fixture: ComponentFixture<AllModuleCardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AllModuleCardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AllModuleCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
